// Callable que analiza un comprobante de pago (PDF o imagen), extrae
// proveedor + monto + fecha + referencia, y devuelve la mejor sugerencia
// de factura pendiente (status='pending', documentKind='invoice') más
// la lista completa de candidatos.
//
// Cadena de proveedores (en extract-with-fallback.ts):
//   1) Gemini 2.5 Flash (vision)
//   2) Groq Llama 4 Scout (vision, si GROQ_API_KEY está configurada)
//   3) Para PDFs solamente: pdf-parse → Cerebras Llama 3.1 8B
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { db } from './firestore.js';
import { LLMRouter } from './llm-router.js';
import { extractWithFallback, ExtractionFailedError } from './extract-with-fallback.js';
import { getUsageSnapshot } from './ai-usage-stats.js';
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
        .describe('Nombre del proveedor o beneficiario que recibe el pago. Vacío si no es claro.'),
    amount: z
        .number()
        .describe('Monto total del pago en pesos colombianos, sin separadores. 0 si no es claro.'),
    date: z
        .string()
        .describe('Fecha del pago en formato YYYY-MM-DD. Cadena vacía si no es clara.'),
    referenceNumber: z
        .string()
        .optional()
        .describe('Número de referencia, transacción o factura asociada si aparece visible.'),
});
const EMPTY_EXTRACTION = {
    supplierName: '',
    amount: 0,
    date: '',
    referenceNumber: undefined,
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
function nameSimilarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb)
        return 0;
    if (na === nb)
        return 1;
    if (na.includes(nb) || nb.includes(na))
        return 0.85;
    const ta = new Set(na.split(' ').filter((x) => x.length > 2));
    const tb = new Set(nb.split(' ').filter((x) => x.length > 2));
    if (ta.size === 0 || tb.size === 0)
        return 0;
    let shared = 0;
    for (const t of ta)
        if (tb.has(t))
            shared++;
    return shared / Math.max(ta.size, tb.size);
}
function tsToDateStr(ts) {
    if (!ts || typeof ts !== 'object')
        return null;
    const seconds = ts._seconds ??
        ts.seconds;
    if (typeof seconds !== 'number')
        return null;
    const d = new Date(seconds * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Singleton router.
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
export const analyzePaymentReceipt = onCall({
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
    await assertCompanyMember(request.auth.uid, data.companyId);
    // 1) Extraer datos del comprobante con la cadena de fallback.
    const prompt = 'Este es un comprobante de pago (transferencia, recibo, soporte bancario, etc.). ' +
        'Extrae el nombre del proveedor/beneficiario que RECIBE el dinero, el monto pagado, ' +
        'la fecha del pago y un número de referencia si aparece visible. ' +
        'Para amount devuelve solo el número sin separadores ni símbolo. ' +
        'Si algún campo no está claro, déjalo vacío (string vacío o 0). NO inventes datos.';
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
        });
        extracted = result.object;
        provider = result.provider;
        fallbackUsed = result.fallbackUsed;
        console.log(`[analyzePaymentReceipt] extracted via ${provider} (fallback=${fallbackUsed})`);
    }
    catch (err) {
        extractionFailed = true;
        if (err instanceof ExtractionFailedError) {
            console.error('[analyzePaymentReceipt] all providers failed:', err.attempts);
        }
        else {
            console.error('[analyzePaymentReceipt] unexpected error:', err);
        }
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
        .get();
    const pendings = txSnap.docs.map((d) => {
        const t = d.data();
        const payeeRef = t.payeeRef;
        return {
            id: d.id,
            docNumber: String(t.docNumber ?? ''),
            supplierName: payeeRef?.name ?? '',
            amount: Number(t.amount ?? 0),
            date: tsToDateStr(t.date),
        };
    });
    // 3) Rankear contra el extracted. Combina similitud de nombre + cercanía de monto.
    const candidates = pendings.map((p) => {
        const nameScore = nameSimilarity(extracted.supplierName, p.supplierName);
        const amountDeltaPct = p.amount > 0
            ? Math.abs(extracted.amount - p.amount) / p.amount
            : 1;
        const amountScore = Math.max(0, 1 - amountDeltaPct * 4);
        const score = nameScore * 0.6 + amountScore * 0.4;
        return { invoiceId: p.id, ...p, nameScore, amountDeltaPct, score };
    });
    candidates.sort((a, b) => b.score - a.score);
    // 4) Sugerencia top con nivel de confianza.
    let suggestion;
    const top = candidates[0];
    if (top && top.score > 0.1) {
        let confidence;
        if (top.nameScore >= 0.85 && top.amountDeltaPct <= 0.02) {
            confidence = 'high';
        }
        else if (top.nameScore >= 0.5 && top.amountDeltaPct <= 0.05) {
            confidence = 'medium';
        }
        else {
            confidence = 'low';
        }
        suggestion = {
            invoiceId: top.invoiceId,
            docNumber: top.docNumber,
            supplierName: top.supplierName,
            amount: top.amount,
            date: top.date,
            confidence,
            amountDeltaPct: top.amountDeltaPct,
        };
    }
    // 5) Fallback adicional: si la extracción no dio nombre pero hay UNA SOLA factura
    //    pendiente con monto exacto (±2%), sugerirla con confianza media. Esto cubre
    //    comprobantes bancarios COL (Bancolombia/Nequi/PSE) que rara vez traen nombre.
    if (!suggestion && extracted.amount > 0) {
        const exactAmount = candidates.filter((c) => Math.abs(extracted.amount - c.amount) / c.amount <= 0.02);
        if (exactAmount.length === 1) {
            const c = exactAmount[0];
            suggestion = {
                invoiceId: c.invoiceId,
                docNumber: c.docNumber,
                supplierName: c.supplierName,
                amount: c.amount,
                date: c.date,
                confidence: 'medium',
                amountDeltaPct: c.amountDeltaPct,
            };
        }
    }
    let usage;
    try {
        usage = await getUsageSnapshot();
    }
    catch (err) {
        console.warn('[analyzePaymentReceipt] getUsageSnapshot failed:', err);
    }
    return {
        extracted,
        suggestion,
        candidates: candidates.map((c) => ({
            invoiceId: c.invoiceId,
            docNumber: c.docNumber,
            supplierName: c.supplierName,
            amount: c.amount,
            date: c.date,
        })),
        extractionFailed,
        provider,
        fallbackUsed,
        usage,
    };
});
//# sourceMappingURL=analyze-payment-receipt.js.map