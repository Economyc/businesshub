// Callable que analiza un comprobante de pago con Gemini Flash 2.5,
// extrae proveedor + monto + fecha, y devuelve la mejor sugerencia de
// factura pendiente (status='pending', documentKind='invoice') más
// la lista completa de candidatos para que el usuario pueda escoger
// manualmente si la sugerencia no calza.
//
// El cliente:
//   1. Llama analyzePaymentReceipt con el archivo en base64
//   2. Muestra la sugerencia con badge de confianza
//   3. Al confirmar: sube el archivo a Drive (uploadDocumentToDrive con
//      docType='Pago') y actualiza la transaction (status='paid',
//      paidDate, paymentProof). No se reusa esta callable en ese paso.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from './firestore.js';
const geminiApiKey = defineSecret('GEMINI_API_KEY');
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
    // Token overlap
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
export const analyzePaymentReceipt = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, secrets: [geminiApiKey] }, async (request) => {
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
    // 1) Extraer datos del comprobante con Gemini Vision.
    const apiKey = geminiApiKey.value();
    if (!apiKey)
        throw new HttpsError('failed-precondition', 'GEMINI_API_KEY no configurada');
    const google = createGoogleGenerativeAI({ apiKey });
    const model = google('gemini-2.5-flash');
    let extracted;
    try {
        const result = await generateObject({
            model,
            schema: ExtractionSchema,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Este es un comprobante de pago (transferencia, recibo, soporte bancario, etc.). ' +
                                'Extrae el nombre del proveedor/beneficiario que RECIBE el dinero, el monto pagado, ' +
                                'la fecha del pago y un número de referencia si aparece visible. ' +
                                'Para amount devuelve solo el número sin separadores ni símbolo. ' +
                                'Si algún campo no está claro, déjalo vacío (string vacío o 0). NO inventes datos.',
                        },
                        {
                            type: 'file',
                            data: data.fileBase64,
                            mimeType: data.mimeType,
                        },
                    ],
                },
            ],
        });
        extracted = result.object;
    }
    catch (err) {
        // Si Gemini falla devolvemos extracted vacío para que el cliente
        // muestre directamente el dropdown manual.
        extracted = { supplierName: '', amount: 0, date: '', referenceNumber: undefined };
        console.error('analyzePaymentReceipt: gemini extraction failed', err);
    }
    // 2) Traer pending invoices de la empresa.
    const txSnap = await db
        .collection('companies')
        .doc(data.companyId)
        .collection('transactions')
        .where('documentKind', '==', 'invoice')
        .where('status', '==', 'pending')
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
    // 3) Rankear contra el extracted. Combina similitud de nombre +
    //    cercanía de monto. Tolerancia ±5% para confianza alta.
    const candidates = pendings.map((p) => {
        const nameScore = nameSimilarity(extracted.supplierName, p.supplierName);
        const amountDeltaPct = p.amount > 0
            ? Math.abs(extracted.amount - p.amount) / p.amount
            : 1;
        // Score: ponderado — nombre 60% + monto 40% (con caída suave del monto).
        const amountScore = Math.max(0, 1 - amountDeltaPct * 4); // 5% off → 0.8, 25% off → 0
        const score = nameScore * 0.6 + amountScore * 0.4;
        return { invoiceId: p.id, ...p, nameScore, amountDeltaPct, score };
    });
    candidates.sort((a, b) => b.score - a.score);
    // 4) Construir sugerencia top con nivel de confianza.
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
    };
});
//# sourceMappingURL=analyze-payment-receipt.js.map