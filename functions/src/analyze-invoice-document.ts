// Callable que analiza una factura o compra (PDF o imagen) y extrae los
// campos del formulario: supplierName, docNumber, date, amount, category, notes.
//
// Cadena de proveedores (en extract-with-fallback.ts):
//   1) Gemini 2.5 Flash (vision nativo, lee PDFs e imágenes directo)
//   2) Groq Llama 4 Scout (vision, si GROQ_API_KEY está configurada)
//   3) Para PDFs solamente: pdf-parse → Cerebras Llama 3.1 8B
//
// La respuesta incluye flags para que el cliente sepa si la extracción
// realmente falló (vs. salió vacía intencionalmente porque el documento
// no era legible).

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { z } from 'zod'
import { db } from './firestore.js'
import { LLMRouter } from './llm-router.js'
import { extractWithFallback, ExtractionFailedError } from './extract-with-fallback.js'
import { getUsageSnapshot, type UsageSnapshot } from './ai-usage-stats.js'
import { parseCopAmount } from './parse-cop.js'

const geminiApiKey = defineSecret('GEMINI_API_KEY')
const groqApiKey = defineSecret('GROQ_API_KEY')
const cerebrasApiKey = defineSecret('CEREBRAS_API_KEY')

interface AnalyzeInput {
  companyId: string
  fileBase64: string
  mimeType: string
  kind: 'invoice' | 'purchase'
}

interface MemberDoc {
  userId: string
  role: string
  status: 'active' | 'invited' | 'suspended'
}

async function assertCompanyMember(uid: string, companyId: string): Promise<void> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('members')
    .doc(uid)
    .get()
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No eres miembro de esta empresa')
  }
  const m = snap.data() as MemberDoc
  if (m.status !== 'active') {
    throw new HttpsError('permission-denied', 'Tu cuenta no está activa en esta empresa')
  }
}

const ExtractionSchema = z.object({
  supplierName: z
    .string()
    .describe('Nombre del proveedor o vendedor que emite el documento. Vacío si no es claro.'),
  docNumber: z
    .string()
    .describe('Número de factura, cuenta de cobro o recibo. Solo el número/código sin texto. Vacío si no es claro.'),
  date: z
    .string()
    .describe('Fecha de emisión del documento en formato YYYY-MM-DD. Cadena vacía si no es clara.'),
  amountRaw: z
    .string()
    .describe(
      'El valor total a pagar EXACTAMENTE como aparece impreso en el documento, ' +
      'con sus separadores y símbolo tal cual (ej. "$1.197.773,00" o "10.200,40"). ' +
      'NO conviertas ni quites separadores. Cadena vacía si no es claro.',
    ),
  category: z
    .string()
    .describe('Categoría que mejor describe el gasto. Si la lista de categorías existentes contiene una apropiada, devuelve EXACTAMENTE ese nombre. Si ninguna calza, propone una nueva en español capitalizada (ej. "Servicios Públicos").'),
  notes: z
    .string()
    .optional()
    .describe('Contexto adicional útil que aparezca en el documento (ej. concepto/descripción del servicio). Máximo 1 línea.'),
})

type Extraction = z.infer<typeof ExtractionSchema>

const EMPTY_EXTRACTION: Extraction = {
  supplierName: '',
  docNumber: '',
  date: '',
  amountRaw: '',
  category: '',
  notes: undefined,
}

// Forma que consume el cliente: el monto ya parseado a entero de pesos.
interface ClientExtraction extends Omit<Extraction, 'amountRaw'> {
  amount: number
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarSupplier(extractedName: string, supplierName: string): number {
  const a = normalize(extractedName)
  const b = normalize(supplierName)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85
  const ta = new Set(a.split(' ').filter((x) => x.length > 2))
  const tb = new Set(b.split(' ').filter((x) => x.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size)
}

// Singleton router (sobrevive entre invocaciones warm).
let router: LLMRouter | null = null
function getRouter(): LLMRouter {
  if (!router) {
    router = new LLMRouter()
      .addGemini(geminiApiKey.value())
      .addGroq(groqApiKey.value())
      .addCerebras(cerebrasApiKey.value())
  }
  return router
}

export const analyzeInvoiceDocument = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    secrets: [geminiApiKey, groqApiKey, cerebrasApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as AnalyzeInput
    if (!data?.companyId) throw new HttpsError('invalid-argument', 'companyId requerido')
    if (!data.fileBase64) throw new HttpsError('invalid-argument', 'fileBase64 requerido')
    if (!data.mimeType) throw new HttpsError('invalid-argument', 'mimeType requerido')
    if (data.kind !== 'invoice' && data.kind !== 'purchase') {
      throw new HttpsError('invalid-argument', 'kind debe ser invoice o purchase')
    }

    await assertCompanyMember(request.auth.uid, data.companyId)

    // Cargar categorías y proveedores para que el modelo escoja del catálogo.
    // `suppliers` es colección raíz compartida entre companies (ver firestore.ts).
    const [settingsSnap, suppliersSnap] = await Promise.all([
      db.collection('companies').doc(data.companyId).collection('settings').doc('categories').get(),
      db.collection('suppliers').get(),
    ])

    const categoryItems = (() => {
      if (!settingsSnap.exists) return [] as string[]
      const raw = settingsSnap.data() as { items?: Array<{ name?: string }> } | undefined
      return (raw?.items ?? []).map((c) => c?.name ?? '').filter(Boolean)
    })()

    const suppliers = suppliersSnap.docs.map((d) => {
      const t = d.data() as { name?: string }
      return { id: d.id, name: t?.name ?? '' }
    })

    const docKindLabel = data.kind === 'invoice'
      ? 'factura o cuenta de cobro (cuenta por pagar)'
      : 'compra al contado (recibo, factura POS)'

    const categoryHint = categoryItems.length > 0
      ? `Categorías existentes en la empresa (devuelve una de estas si calza, exacta): ${categoryItems.join(', ')}.`
      : 'No hay categorías registradas todavía — propone una en español capitalizada.'

    const prompt =
      `Este documento es una ${docKindLabel}. Extrae los campos del formulario:\n` +
      `- supplierName: razón social o nombre comercial del proveedor que EMITE el documento (no el cliente).\n` +
      `- docNumber: solo el número/código de la factura, recibo o cuenta de cobro.\n` +
      `- date: fecha de emisión en YYYY-MM-DD.\n` +
      `- amountRaw: el total a pagar TAL CUAL aparece impreso, con sus separadores y símbolo (ej. "$1.197.773,00" o "10.200,40"). No conviertas ni quites separadores.\n` +
      `- category: ${categoryHint}\n` +
      `- notes (opcional): 1 línea con concepto o descripción si aparece.\n\n` +
      `Si algún campo no se puede leer con seguridad, déjalo vacío (string vacío o 0). NO inventes datos.`

    let extracted: Extraction = EMPTY_EXTRACTION
    let extractionFailed = false
    let provider = 'none'
    let fallbackUsed = false

    try {
      const result = await extractWithFallback({
        router: getRouter(),
        schema: ExtractionSchema,
        prompt,
        fileBase64: data.fileBase64,
        mimeType: data.mimeType,
        // Sin proveedor, número, fecha ni monto no hay nada útil: escalar a OCR
        // (PDF) o marcar fallo. category se autopropone, no cuenta como dato.
        isResultEmpty: (o) =>
          !o.supplierName.trim() && !o.docNumber.trim() && !o.date.trim() && !o.amountRaw.trim(),
      })
      extracted = result.object
      provider = result.provider
      fallbackUsed = result.fallbackUsed
      console.log(`[analyzeInvoiceDocument] extracted via ${provider} (fallback=${fallbackUsed})`)
    } catch (err) {
      extractionFailed = true
      if (err instanceof ExtractionFailedError) {
        console.error('[analyzeInvoiceDocument] all providers failed:', err.attempts)
      } else {
        console.error('[analyzeInvoiceDocument] unexpected error:', err)
      }
    }

    // Match de proveedor contra el catálogo registrado.
    let supplierMatch: { id: string; name: string; score: number } | undefined
    if (extracted.supplierName) {
      const scored = suppliers
        .map((s) => ({ ...s, score: similarSupplier(extracted.supplierName, s.name) }))
        .sort((a, b) => b.score - a.score)
      if (scored.length > 0 && scored[0].score >= 0.5) {
        supplierMatch = scored[0]
      }
    }

    const categoryExists = categoryItems.includes(extracted.category)

    // Parseo determinista del monto (formato CO). El modelo solo transcribe el
    // literal en amountRaw; aquí lo convertimos a entero de pesos.
    const { amountRaw, ...rest } = extracted
    const clientExtracted: ClientExtraction = {
      ...rest,
      amount: parseCopAmount(amountRaw),
    }

    // Snapshot mensual de uso IA (fail-soft: si Firestore falla, omitimos).
    let usage: UsageSnapshot | undefined
    try {
      usage = await getUsageSnapshot()
    } catch (err) {
      console.warn('[analyzeInvoiceDocument] getUsageSnapshot failed:', err)
    }

    return {
      extracted: clientExtracted,
      supplierMatch,
      categoryExists,
      extractionFailed,
      provider,
      fallbackUsed,
      usage,
    }
  },
)
