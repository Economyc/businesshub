// Callable que analiza un comprobante de pago (PDF o imagen), extrae
// proveedor + monto + fecha + referencia, y devuelve la mejor sugerencia
// de factura pendiente (status='pending', documentKind='invoice') más
// la lista completa de candidatos.
//
// Cadena de proveedores (en extract-with-fallback.ts):
//   1) Gemini 2.5 Flash (vision)
//   2) Groq Llama 4 Scout (vision, si GROQ_API_KEY está configurada)
//   3) Para PDFs solamente: pdf-parse → Cerebras Llama 3.1 8B

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { z } from 'zod'
import { db } from './firestore.js'
import { LLMRouter, DOC_GEMINI_MODEL } from './llm-router.js'
import {
  extractWithFallback,
  ExtractionFailedError,
  ExtractionBudgetExceededError,
  describeExtractionFailure,
} from './extract-with-fallback.js'
import { getUsageSnapshot, type UsageSnapshot } from './ai-usage-stats.js'
import { parseCopAmount } from './parse-cop.js'
import { pendingOf } from './utils/withholding.js'

// Key del free tier (proyecto sin facturación): va de primera y se usa hasta
// que Google le corta la cuota diaria.
// Misma cascada de tiempos que analyze-invoice-document.ts (ver el comentario
// allí). OJO: gcloud IGNORA el `timeoutSeconds` del literal → pasar --timeout=90.
const CALLABLE_BUDGET_MS = 70_000
const ATTEMPT_TIMEOUT_MS = 20_000

const geminiFreeApiKey = defineSecret('GEMINI_API_KEY_FREE')
// Key del proyecto con facturación: releva a la gratis cuando esta se agota.
const geminiApiKey = defineSecret('GEMINI_API_KEY')
const groqApiKey = defineSecret('GROQ_API_KEY')
const cerebrasApiKey = defineSecret('CEREBRAS_API_KEY')

interface AnalyzeInput {
  companyId: string
  fileBase64: string
  mimeType: string
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
    .describe('Nombre del proveedor o beneficiario que recibe el pago. Vacío si no es claro.'),
  amountRaw: z
    .string()
    .describe(
      'El monto total del pago EXACTAMENTE como aparece impreso en el comprobante, ' +
      'con sus separadores y símbolo tal cual (ej. "$1.197.773,00" o "10.200,40"). ' +
      'NO conviertas ni quites separadores. Cadena vacía si no es claro.',
    ),
  date: z
    .string()
    .describe('Fecha del pago en formato YYYY-MM-DD. Cadena vacía si no es clara.'),
  referenceNumber: z
    .string()
    .optional()
    .describe('Número de referencia, transacción o factura asociada si aparece visible.'),
})

type Extraction = z.infer<typeof ExtractionSchema>

const EMPTY_EXTRACTION: Extraction = {
  supplierName: '',
  amountRaw: '',
  date: '',
  referenceNumber: undefined,
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

function nameSimilarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const ta = new Set(na.split(' ').filter((x) => x.length > 2))
  const tb = new Set(nb.split(' ').filter((x) => x.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size)
}

function tsToDateStr(ts: unknown): string | null {
  if (!ts || typeof ts !== 'object') return null
  const seconds = (ts as { _seconds?: number; seconds?: number })._seconds ??
    (ts as { _seconds?: number; seconds?: number }).seconds
  if (typeof seconds !== 'number') return null
  const d = new Date(seconds * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface CandidateInternal {
  invoiceId: string
  docNumber: string
  supplierName: string
  amount: number
  date: string | null
  nameScore: number
  amountDeltaPct: number
  score: number
}

// Singleton router.
let router: LLMRouter | null = null
function getRouter(): LLMRouter {
  if (!router) {
    router = new LLMRouter()
      .addGemini(geminiFreeApiKey.value(), { modelId: DOC_GEMINI_MODEL })
      .addGeminiPaid(geminiApiKey.value(), { modelId: DOC_GEMINI_MODEL })
      .addGroq(groqApiKey.value())
      .addCerebras(cerebrasApiKey.value())
  }
  return router
}

export const analyzePaymentReceipt = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    // 90s: con el corte por intento de 20s la cadena entera cabe en el
    // presupuesto interno de 70s.
    timeoutSeconds: 90,
    secrets: [geminiFreeApiKey, geminiApiKey, groqApiKey, cerebrasApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as AnalyzeInput
    if (!data?.companyId) throw new HttpsError('invalid-argument', 'companyId requerido')
    if (!data.fileBase64) throw new HttpsError('invalid-argument', 'fileBase64 requerido')
    if (!data.mimeType) throw new HttpsError('invalid-argument', 'mimeType requerido')

    await assertCompanyMember(request.auth.uid, data.companyId)

    // 1) Extraer datos del comprobante con la cadena de fallback.
    const prompt =
      'Este es un comprobante de pago (transferencia, recibo, soporte bancario, etc.). ' +
      'Extrae el nombre del proveedor/beneficiario que RECIBE el dinero, el monto pagado, ' +
      'la fecha del pago y un número de referencia si aparece visible. ' +
      'Para amountRaw devuelve el monto TAL CUAL aparece impreso, con sus separadores y símbolo ' +
      '(ej. "$1.197.773,00" o "10.200,40"); no conviertas ni quites separadores. ' +
      'Si algún campo no está claro, déjalo vacío. NO inventes datos.'

    const startedAt = Date.now()
    let extracted: Extraction = EMPTY_EXTRACTION
    let extractionFailed = false
    let failureReason: string | undefined
    let failureCode: 'timeout' | 'providers' | undefined
    let provider = 'none'
    let fallbackUsed = false

    try {
      const result = await extractWithFallback({
        router: getRouter(),
        schema: ExtractionSchema,
        prompt,
        fileBase64: data.fileBase64,
        mimeType: data.mimeType,
        // Sin proveedor, monto ni fecha no hay nada útil: escalar a OCR (PDF)
        // o marcar fallo en vez de devolver un comprobante vacío.
        isResultEmpty: (o) =>
          !o.supplierName.trim() && !o.amountRaw.trim() && !o.date.trim(),
        deadlineAt: startedAt + CALLABLE_BUDGET_MS,
        attemptTimeoutMs: ATTEMPT_TIMEOUT_MS,
      })
      extracted = result.object
      provider = result.provider
      fallbackUsed = result.fallbackUsed
      console.log(`[analyzePaymentReceipt] extracted via ${provider} (fallback=${fallbackUsed})`)
    } catch (err) {
      extractionFailed = true
      failureReason = describeExtractionFailure(err)
      failureCode = err instanceof ExtractionBudgetExceededError ? 'timeout' : 'providers'
      if (err instanceof ExtractionBudgetExceededError) {
        console.error(
          `[analyzePaymentReceipt] presupuesto agotado en ${Date.now() - startedAt}ms:`,
          err.attempts,
        )
      } else if (err instanceof ExtractionFailedError) {
        console.error('[analyzePaymentReceipt] all providers failed:', err.attempts)
      } else {
        console.error('[analyzePaymentReceipt] unexpected error:', err)
      }
    }

    // Parseo determinista del monto (formato CO). El modelo solo transcribe el
    // literal en amountRaw; aquí lo convertimos a entero de pesos.
    const { amountRaw, ...rest } = extracted
    const clientExtracted: ClientExtraction = {
      ...rest,
      amount: parseCopAmount(amountRaw),
    }

    // 2) Traer facturas pendientes de la empresa. Incluye 'overdue': las
    //    facturas viejas sin pagar suelen estar vencidas y deben poder
    //    cruzarse con un comprobante igual que las del mes (espeja a
    //    useInvoicesPending en el frontend).
    const txSnap = await db
      .collection('companies')
      .doc(data.companyId)
      .collection('transactions')
      .where('documentKind', '==', 'invoice')
      .where('status', 'in', ['pending', 'overdue'])
      .get()

    const pendings = txSnap.docs.map((d) => {
      const t = d.data() as Record<string, unknown>
      const payeeRef = t.payeeRef as { name?: string } | undefined
      return {
        id: d.id,
        docNumber: String(t.docNumber ?? ''),
        supplierName: payeeRef?.name ?? '',
        amount: Number(t.amount ?? 0),
        // El comprobante trae lo que SALIÓ del banco, que con retefuente es el
        // neto. Cruzar contra el bruto rompería el match: una retención del 4%
        // ya excede la tolerancia del 2% para auto-emparejar.
        payable: pendingOf(t as { amount?: number; paidAmount?: number; remainingAmount?: number; withholdingAmount?: number }),
        date: tsToDateStr(t.date),
      }
    })

    // 3) Rankear contra el extracted. Combina similitud de nombre + cercanía de monto.
    const candidates: CandidateInternal[] = pendings.map((p) => {
      const nameScore = nameSimilarity(clientExtracted.supplierName, p.supplierName)
      const amountDeltaPct = p.payable > 0
        ? Math.abs(clientExtracted.amount - p.payable) / p.payable
        : 1
      const amountScore = Math.max(0, 1 - amountDeltaPct * 4)
      const score = nameScore * 0.6 + amountScore * 0.4
      return { invoiceId: p.id, ...p, nameScore, amountDeltaPct, score }
    })

    candidates.sort((a, b) => b.score - a.score)

    // 4) Sugerencia top con nivel de confianza.
    let suggestion: {
      invoiceId: string
      docNumber: string
      supplierName: string
      amount: number
      date: string | null
      confidence: 'high' | 'medium' | 'low'
      amountDeltaPct: number
    } | undefined

    const top = candidates[0]
    if (top && top.score > 0.1) {
      let confidence: 'high' | 'medium' | 'low'
      if (top.nameScore >= 0.85 && top.amountDeltaPct <= 0.02) {
        confidence = 'high'
      } else if (top.nameScore >= 0.5 && top.amountDeltaPct <= 0.05) {
        confidence = 'medium'
      } else {
        confidence = 'low'
      }
      suggestion = {
        invoiceId: top.invoiceId,
        docNumber: top.docNumber,
        supplierName: top.supplierName,
        amount: top.amount,
        date: top.date,
        confidence,
        amountDeltaPct: top.amountDeltaPct,
      }
    }

    // 5) Fallback adicional: si la extracción no dio nombre pero hay UNA SOLA factura
    //    pendiente con monto exacto (±2%), sugerirla con confianza media. Esto cubre
    //    comprobantes bancarios COL (Bancolombia/Nequi/PSE) que rara vez traen nombre.
    if (!suggestion && clientExtracted.amount > 0) {
      const exactAmount = candidates.filter(
        (c) => Math.abs(clientExtracted.amount - c.amount) / c.amount <= 0.02,
      )
      if (exactAmount.length === 1) {
        const c = exactAmount[0]
        suggestion = {
          invoiceId: c.invoiceId,
          docNumber: c.docNumber,
          supplierName: c.supplierName,
          amount: c.amount,
          date: c.date,
          confidence: 'medium',
          amountDeltaPct: c.amountDeltaPct,
        }
      }
    }

    let usage: UsageSnapshot | undefined
    try {
      usage = await getUsageSnapshot()
    } catch (err) {
      console.warn('[analyzePaymentReceipt] getUsageSnapshot failed:', err)
    }

    return {
      extracted: clientExtracted,
      suggestion,
      candidates: candidates.map((c) => ({
        invoiceId: c.invoiceId,
        docNumber: c.docNumber,
        supplierName: c.supplierName,
        amount: c.amount,
        date: c.date,
      })),
      extractionFailed,
      failureReason,
      failureCode,
      provider,
      fallbackUsed,
      usage,
    }
  },
)
