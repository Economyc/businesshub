// Callable que analiza una factura o compra (PDF o imagen) con Gemini
// Flash 2.5 y extrae los campos del formulario:
//   supplierName, docNumber, date, amount, category, notes
//
// Para la categoría, recibe la lista de categorías que la empresa ya
// usa y pide al modelo que escoja la mejor (o sugiera nueva si nada
// calza). Devuelve también un sugerido de match contra el listado de
// proveedores registrados (suppliers) para que el cliente pueda
// auto-seleccionar en el dropdown sin que el usuario teclee de nuevo.
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
        .describe('Nombre del proveedor o vendedor que emite el documento. Vacío si no es claro.'),
    docNumber: z
        .string()
        .describe('Número de factura, cuenta de cobro o recibo. Solo el número/código sin texto. Vacío si no es claro.'),
    date: z
        .string()
        .describe('Fecha de emisión del documento en formato YYYY-MM-DD. Cadena vacía si no es clara.'),
    amount: z
        .number()
        .describe('Valor total a pagar en pesos colombianos, sin separadores ni símbolos. 0 si no es claro.'),
    category: z
        .string()
        .describe('Categoría que mejor describe el gasto. Si la lista de categorías existentes contiene una apropiada, devuelve EXACTAMENTE ese nombre. Si ninguna calza, propone una nueva en español capitalizada (ej. "Servicios Públicos").'),
    notes: z
        .string()
        .optional()
        .describe('Contexto adicional útil que aparezca en el documento (ej. concepto/descripción del servicio). Máximo 1 línea.'),
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
export const analyzeInvoiceDocument = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, secrets: [geminiApiKey] }, async (request) => {
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
    if (data.kind !== 'invoice' && data.kind !== 'purchase') {
        throw new HttpsError('invalid-argument', 'kind debe ser invoice o purchase');
    }
    await assertCompanyMember(request.auth.uid, data.companyId);
    // Cargar categorías y proveedores para que el modelo escoja del
    // catálogo existente cuando aplique.
    const [settingsSnap, suppliersSnap] = await Promise.all([
        db.collection('companies').doc(data.companyId).collection('settings').doc('categories').get(),
        db.collection('companies').doc(data.companyId).collection('suppliers').get(),
    ]);
    const categoryItems = (() => {
        if (!settingsSnap.exists)
            return [];
        const raw = settingsSnap.data();
        return (raw?.items ?? []).map((c) => c?.name ?? '').filter(Boolean);
    })();
    const suppliers = suppliersSnap.docs.map((d) => {
        const t = d.data();
        return { id: d.id, name: t?.name ?? '' };
    });
    const docKindLabel = data.kind === 'invoice'
        ? 'factura o cuenta de cobro (cuenta por pagar)'
        : 'compra al contado (recibo, factura POS)';
    const categoryHint = categoryItems.length > 0
        ? `Categorías existentes en la empresa (devuelve una de estas si calza, exacta): ${categoryItems.join(', ')}.`
        : 'No hay categorías registradas todavía — propone una en español capitalizada.';
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
                            text: `Este documento es una ${docKindLabel}. Extrae los campos del formulario:\n` +
                                `- supplierName: razón social o nombre comercial del proveedor que EMITE el documento (no el cliente).\n` +
                                `- docNumber: solo el número/código de la factura, recibo o cuenta de cobro.\n` +
                                `- date: fecha de emisión en YYYY-MM-DD.\n` +
                                `- amount: total a pagar (sin separadores ni símbolos), solo el número.\n` +
                                `- category: ${categoryHint}\n` +
                                `- notes (opcional): 1 línea con concepto o descripción si aparece.\n\n` +
                                `Si algún campo no se puede leer con seguridad, déjalo vacío (string vacío o 0). NO inventes datos.`,
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
        extracted = { supplierName: '', docNumber: '', date: '', amount: 0, category: '', notes: undefined };
        console.error('analyzeInvoiceDocument: gemini extraction failed', err);
    }
    // Match de proveedor contra el catálogo registrado.
    let supplierMatch;
    if (extracted.supplierName) {
        const scored = suppliers
            .map((s) => ({ ...s, score: similarSupplier(extracted.supplierName, s.name) }))
            .sort((a, b) => b.score - a.score);
        if (scored.length > 0 && scored[0].score >= 0.5) {
            supplierMatch = scored[0];
        }
    }
    // Si la categoría devuelta no calza exactamente con alguna existente,
    // devolvemos también la propuesta para que el cliente sepa que es nueva.
    const categoryExists = categoryItems.includes(extracted.category);
    return {
        extracted,
        supplierMatch,
        categoryExists,
    };
});
//# sourceMappingURL=analyze-invoice-document.js.map