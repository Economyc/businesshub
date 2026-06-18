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
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { db } from './firestore.js';
import { LLMRouter } from './llm-router.js';
import { extractWithFallback, ExtractionFailedError } from './extract-with-fallback.js';
import { getUsageSnapshot } from './ai-usage-stats.js';
import { parseCopAmount } from './parse-cop.js';
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const groqApiKey = defineSecret('GROQ_API_KEY');
const cerebrasApiKey = defineSecret('CEREBRAS_API_KEY');
async function assertCompanyMember(uid, companyId) {
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection('members')
        .doc(uid)
        .get();
    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'No eres miembro de esta empresa');
    }
    const m = snap.data();
    if (m.status !== 'active') {
        throw new HttpsError('permission-denied', 'Tu cuenta no está activa en esta empresa');
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
        .describe('El valor total a pagar EXACTAMENTE como aparece impreso en el documento, ' +
        'con sus separadores y símbolo tal cual (ej. "$1.197.773,00" o "10.200,40"). ' +
        'NO conviertas ni quites separadores. Cadena vacía si no es claro.'),
    category: z
        .string()
        .describe('Categoría que mejor describe el gasto. Si la lista de categorías existentes contiene una apropiada, devuelve EXACTAMENTE ese nombre. Si ninguna calza, propone una nueva en español capitalizada (ej. "Servicios Públicos").'),
    notes: z
        .string()
        .optional()
        .describe('Contexto adicional útil que aparezca en el documento (ej. concepto/descripción del servicio). Máximo 1 línea.'),
});
const EMPTY_EXTRACTION = {
    supplierName: '',
    docNumber: '',
    date: '',
    amountRaw: '',
    category: '',
    notes: undefined,
};
function normalize(s) {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function similarSupplier(extractedName, supplierName) {
    const a = normalize(extractedName);
    const b = normalize(supplierName);
    if (!a || !b)
        return 0;
    if (a === b)
        return 1;
    if (a.includes(b) || b.includes(a))
        return 0.85;
    const ta = new Set(a.split(' ').filter((x) => x.length > 2));
    const tb = new Set(b.split(' ').filter((x) => x.length > 2));
    if (ta.size === 0 || tb.size === 0)
        return 0;
    let shared = 0;
    for (const t of ta)
        if (tb.has(t))
            shared++;
    return shared / Math.max(ta.size, tb.size);
}
// Singleton router (sobrevive entre invocaciones warm).
let router = null;
function getRouter() {
    if (!router) {
        router = new LLMRouter()
            .addGemini(geminiApiKey.value())
            .addGroq(groqApiKey.value())
            .addCerebras(cerebrasApiKey.value());
    }
    return router;
}
export const analyzeInvoiceDocument = onCall({
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    secrets: [geminiApiKey, groqApiKey, cerebrasApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const data = request.data;
    if (!data?.companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    if (!data.fileBase64)
        throw new HttpsError('invalid-argument', 'fileBase64 requerido');
    if (!data.mimeType)
        throw new HttpsError('invalid-argument', 'mimeType requerido');
    if (data.kind !== 'invoice' && data.kind !== 'purchase' && data.kind !== 'receivable') {
        throw new HttpsError('invalid-argument', 'kind debe ser invoice, purchase o receivable');
    }
    await assertCompanyMember(request.auth.uid, data.companyId);
    const isReceivable = data.kind === 'receivable';
    // Cargar categorías + catálogo de contraparte para que el modelo escoja de él.
    // En CxC la contraparte es el cliente (`customers`); en CxP el proveedor
    // (`suppliers`). Ambas son colecciones raíz compartidas (ver firestore.ts).
    const [settingsSnap, partiesSnap] = await Promise.all([
        db.collection('companies').doc(data.companyId).collection('settings').doc('categories').get(),
        db.collection(isReceivable ? 'customers' : 'suppliers').get(),
    ]);
    const categoryItems = (() => {
        if (!settingsSnap.exists)
            return [];
        const raw = settingsSnap.data();
        return (raw?.items ?? []).map((c) => c?.name ?? '').filter(Boolean);
    })();
    const parties = partiesSnap.docs.map((d) => {
        const t = d.data();
        return { id: d.id, name: t?.name ?? '' };
    });
    const docKindLabel = data.kind === 'invoice'
        ? 'factura o cuenta de cobro (cuenta por pagar)'
        : data.kind === 'purchase'
            ? 'compra al contado (recibo, factura POS)'
            : 'cuenta de cobro o factura de venta emitida a un cliente (cuenta por cobrar)';
    const categoryHint = categoryItems.length > 0
        ? `Categorías existentes en la empresa (devuelve una de estas si calza, exacta): ${categoryItems.join(', ')}.`
        : 'No hay categorías registradas todavía — propone una en español capitalizada.';
    // El campo supplierName transporta la contraparte: en CxP el proveedor que
    // EMITE el documento; en CxC el cliente que nos DEBE (destinatario del cobro).
    const partyInstruction = isReceivable
        ? 'supplierName: razón social o nombre del CLIENTE al que se le emite la cuenta de cobro (quien nos debe), no el emisor.'
        : 'supplierName: razón social o nombre comercial del proveedor que EMITE el documento (no el cliente).';
    const prompt = `Este documento es una ${docKindLabel}. Extrae los campos del formulario:\n` +
        `- ${partyInstruction}\n` +
        `- docNumber: solo el número/código de la factura, recibo o cuenta de cobro.\n` +
        `- date: fecha de emisión en YYYY-MM-DD.\n` +
        `- amountRaw: el total a pagar TAL CUAL aparece impreso, con sus separadores y símbolo (ej. "$1.197.773,00" o "10.200,40"). No conviertas ni quites separadores.\n` +
        `- category: ${categoryHint}\n` +
        `- notes (opcional): 1 línea con concepto o descripción si aparece.\n\n` +
        `Si algún campo no se puede leer con seguridad, déjalo vacío (string vacío o 0). NO inventes datos.`;
    let extracted = EMPTY_EXTRACTION;
    let extractionFailed = false;
    let provider = 'none';
    let fallbackUsed = false;
    try {
        const result = await extractWithFallback({
            router: getRouter(),
            schema: ExtractionSchema,
            prompt,
            fileBase64: data.fileBase64,
            mimeType: data.mimeType,
            // Sin proveedor, número, fecha ni monto no hay nada útil: escalar a OCR
            // (PDF) o marcar fallo. category se autopropone, no cuenta como dato.
            isResultEmpty: (o) => !o.supplierName.trim() && !o.docNumber.trim() && !o.date.trim() && !o.amountRaw.trim(),
        });
        extracted = result.object;
        provider = result.provider;
        fallbackUsed = result.fallbackUsed;
        console.log(`[analyzeInvoiceDocument] extracted via ${provider} (fallback=${fallbackUsed})`);
    }
    catch (err) {
        extractionFailed = true;
        if (err instanceof ExtractionFailedError) {
            console.error('[analyzeInvoiceDocument] all providers failed:', err.attempts);
        }
        else {
            console.error('[analyzeInvoiceDocument] unexpected error:', err);
        }
    }
    // Match de la contraparte contra el catálogo registrado (proveedor o cliente).
    let partyMatch;
    if (extracted.supplierName) {
        const scored = parties
            .map((s) => ({ ...s, score: similarSupplier(extracted.supplierName, s.name) }))
            .sort((a, b) => b.score - a.score);
        if (scored.length > 0 && scored[0].score >= 0.5) {
            partyMatch = scored[0];
        }
    }
    // supplierMatch para CxP (compat App1); customerMatch para CxC (Ecore).
    const supplierMatch = isReceivable ? undefined : partyMatch;
    const customerMatch = isReceivable ? partyMatch : undefined;
    const categoryExists = categoryItems.includes(extracted.category);
    // Parseo determinista del monto (formato CO). El modelo solo transcribe el
    // literal en amountRaw; aquí lo convertimos a entero de pesos.
    const { amountRaw, ...rest } = extracted;
    const clientExtracted = {
        ...rest,
        amount: parseCopAmount(amountRaw),
    };
    // Snapshot mensual de uso IA (fail-soft: si Firestore falla, omitimos).
    let usage;
    try {
        usage = await getUsageSnapshot();
    }
    catch (err) {
        console.warn('[analyzeInvoiceDocument] getUsageSnapshot failed:', err);
    }
    return {
        extracted: clientExtracted,
        supplierMatch,
        customerMatch,
        categoryExists,
        extractionFailed,
        provider,
        fallbackUsed,
        usage,
    };
});
//# sourceMappingURL=analyze-invoice-document.js.map