// Callable que analiza un documento de nómina y extrae sus campos.
//
// Dos modos (`kind`):
//   - 'colilla'  → un desprendible de nómina por empleado (PDF/imagen).
//                  Extrae trabajador, cédula, cargo, periodo, total devengado,
//                  total deducciones y neto cancelado.
//   - 'propinas' → una tabla con las propinas de todos los empleados de un
//                  local (imagen/PDF, o texto ya parseado de Excel/CSV).
//                  Extrae filas { empleado, valor } + total.
//
// El emparejamiento contra los empleados registrados se hace en el cliente
// (la vista ya tiene la lista de empleados de la company). Esta callable solo
// extrae lo que dice el documento. La estructura de los archivos puede cambiar
// a futuro: se usa IA de visión + schema flexible, nunca parsing posicional.
//
// Cadena de proveedores y fallback: ver extract-with-fallback.ts.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from './firestore.js';
import { LLMRouter, isRateLimitError, isCreditDepletedError, parseRetryAfter, } from './llm-router.js';
import { extractWithFallback, ExtractionFailedError } from './extract-with-fallback.js';
import { getUsageSnapshot, recordUsage, providerToField, } from './ai-usage-stats.js';
import { parseCopAmount } from './parse-cop.js';
/** Tamaño máx. del archivo en base64 (~9 MB reales). Evita OOM / límite callable. */
const MAX_FILE_B64 = 12_000_000;
/** Cooldown largo cuando un provider se quedó sin créditos prepagados. */
const CREDITS_DEPLETED_COOLDOWN_MS = 6 * 60 * 60 * 1000;
// Montos colombianos: "1.197.773" / "$1.197.773,00" / 1197773. El modelo a
// veces devuelve string o un número mal tokenizado por el separador de miles.
// parseCopAmount (parse-cop.ts) desambigua decimal vs miles para formato CO/US
// y devuelve entero de pesos.
const copNumber = z.preprocess(parseCopAmount, z.number().nonnegative());
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
const ColillaSchema = z.object({
    employeeName: z
        .string()
        .describe('Nombre completo del trabajador (campo TRABAJADOR). Vacío si no es claro.'),
    identification: z
        .string()
        .describe('Número de cédula del trabajador, solo dígitos sin puntos. Vacío si no aparece.'),
    role: z
        .string()
        .describe('Cargo del trabajador (campo CARGO). Vacío si no aparece.'),
    payPeriod: z
        .string()
        .describe('Periodo de pago tal cual aparece (ej. "1 DE MAYO A 15 DE MAYO"). Vacío si no es claro.'),
    totalDevengado: copNumber.describe('TOTAL DEVENGADO en pesos colombianos enteros. Ej: "1.197.773" → 1197773. 0 si no es claro.'),
    totalDeducciones: copNumber.describe('TOTAL DEDUCCIONES en pesos colombianos enteros. Ej: "70.036" → 70036. 0 si no aparece.'),
    netoCancelado: copNumber.describe('NETO CANCELADO / neto a pagar en pesos colombianos enteros. Ej: "1.127.736" → 1127736. 0 si no es claro.'),
});
const PropinasSchema = z.object({
    rows: z
        .array(z.object({
        employeeName: z.string().describe('Nombre del empleado tal cual aparece.'),
        amount: copNumber.describe('Valor de propina en pesos colombianos enteros. Ej: "594.221" → 594221.'),
    }))
        .describe('Una fila por empleado con propina. NO incluyas la fila de total ni filas vacías.'),
    total: copNumber.describe('Total de propinas si aparece explícito. 0 si no aparece.'),
});
const EMPTY_COLILLA = {
    employeeName: '',
    identification: '',
    role: '',
    payPeriod: '',
    totalDevengado: 0,
    totalDeducciones: 0,
    netoCancelado: 0,
};
const EMPTY_PROPINAS = { rows: [], total: 0 };
const COLILLA_PROMPT = 'Este documento es un desprendible/colilla de liquidación de nómina de UN empleado. ' +
    'Extrae los campos:\n' +
    '- employeeName: nombre completo del trabajador (campo TRABAJADOR).\n' +
    '- identification: número de cédula (solo dígitos).\n' +
    '- role: cargo (campo CARGO).\n' +
    '- payPeriod: periodo de pago tal cual aparece.\n' +
    '- totalDevengado: el valor de TOTAL DEVENGADO (solo número).\n' +
    '- totalDeducciones: el valor de TOTAL DEDUCCIONES (solo número).\n' +
    '- netoCancelado: el valor de NETO CANCELADO / neto a pagar (solo número).\n\n' +
    'Si algún campo no se puede leer con seguridad, déjalo vacío (string vacío o 0). NO inventes datos.';
const PROPINAS_PROMPT = 'Este documento es una tabla con las propinas a pagar a los empleados de un local ' +
    '(columnas típicas: nombre del empleado y valor a pagar). ' +
    'Extrae una fila por empleado con employeeName y amount (el valor TAL CUAL aparece, con sus separadores y símbolo si los tiene; no conviertas). ' +
    'NO incluyas la fila de total ni filas vacías. Si hay un total explícito, devuélvelo en "total". ' +
    'NO inventes empleados ni valores.';
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
/** Telemetría fire-and-forget (espejo de extract-with-fallback.ts). */
function trackSuccess(provider) {
    const field = providerToField(provider);
    if (field)
        void recordUsage(field);
    void recordUsage('totalExtractions');
}
function trackFailure() {
    void recordUsage('totalFailed');
}
// Extracción text-only para propinas que llegan como Excel/CSV ya parseado a
// texto. Reusa el router con la misma política de fallback/telemetría que
// extract-with-fallback.ts (rate-limit, créditos agotados, conteo de uso).
async function extractFromText(schema, prompt, text) {
    const r = getRouter();
    const tried = new Set();
    let lastErr;
    for (let i = 0; i < 3; i++) {
        let modelInfo;
        try {
            modelInfo = await r.getModel({ needsVision: false, exclude: tried });
        }
        catch {
            break;
        }
        tried.add(modelInfo.provider);
        try {
            const result = await generateObject({
                model: modelInfo.model,
                schema,
                messages: [
                    {
                        role: 'user',
                        content: `${prompt}\n\nContenido del archivo (puede estar desordenado por columnas):\n\n${text}`,
                    },
                ],
            });
            trackSuccess(modelInfo.provider);
            return { object: result.object, provider: modelInfo.provider };
        }
        catch (err) {
            lastErr = err;
            if (isCreditDepletedError(err)) {
                await r.markRateLimited(modelInfo.provider, CREDITS_DEPLETED_COOLDOWN_MS, 'credits depleted');
            }
            else if (isRateLimitError(err)) {
                await r.markRateLimited(modelInfo.provider, parseRetryAfter(err), 'payroll text 429');
            }
            else {
                await r.markRateLimited(modelInfo.provider, 30_000, 'payroll text error');
            }
        }
    }
    trackFailure();
    throw new ExtractionFailedError([
        { provider: 'text-only', error: lastErr?.message ?? 'sin proveedores disponibles' },
    ]);
}
// `schema` es z.ZodTypeAny porque copNumber (z.preprocess) hace que input!=output;
// el cast al tipo de salida se hace en el handler (runtime garantizado por copNumber).
async function runExtraction(schema, prompt, data, hasFile, hasText) {
    if (hasText && !hasFile) {
        const r = await extractFromText(schema, prompt, data.spreadsheetText);
        return { object: r.object, provider: r.provider, fallbackUsed: true };
    }
    const r = await extractWithFallback({
        router: getRouter(),
        schema,
        prompt,
        fileBase64: data.fileBase64,
        mimeType: data.mimeType,
    });
    return { object: r.object, provider: r.provider, fallbackUsed: r.fallbackUsed };
}
export const analyzePayrollDocument = onCall({
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
    secrets: [geminiApiKey, groqApiKey, cerebrasApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const data = request.data;
    if (!data?.companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    if (data.kind !== 'colilla' && data.kind !== 'propinas') {
        throw new HttpsError('invalid-argument', 'kind debe ser colilla o propinas');
    }
    const hasFile = !!data.fileBase64 && !!data.mimeType;
    const hasText = !!data.spreadsheetText;
    if (!hasFile && !hasText) {
        throw new HttpsError('invalid-argument', 'Se requiere fileBase64+mimeType o spreadsheetText');
    }
    if (data.fileBase64 && data.fileBase64.length > MAX_FILE_B64) {
        throw new HttpsError('invalid-argument', 'Archivo demasiado grande (máx ~9 MB). Sube un PDF más liviano o una foto comprimida.');
    }
    await assertCompanyMember(request.auth.uid, data.companyId);
    const isColilla = data.kind === 'colilla';
    let extracted = isColilla
        ? EMPTY_COLILLA
        : EMPTY_PROPINAS;
    let extractionFailed = false;
    let provider = 'none';
    let fallbackUsed = false;
    try {
        if (isColilla) {
            const r = await runExtraction(ColillaSchema, COLILLA_PROMPT, data, hasFile, hasText);
            extracted = r.object;
            provider = r.provider;
            fallbackUsed = r.fallbackUsed;
        }
        else {
            const r = await runExtraction(PropinasSchema, PROPINAS_PROMPT, data, hasFile, hasText);
            extracted = r.object;
            provider = r.provider;
            fallbackUsed = r.fallbackUsed;
        }
        console.log(`[analyzePayrollDocument] ${data.kind} extraído vía ${provider} (fallback=${fallbackUsed})`);
    }
    catch (err) {
        extractionFailed = true;
        if (err instanceof ExtractionFailedError) {
            console.error('[analyzePayrollDocument] todos los proveedores fallaron:', err.attempts);
        }
        else {
            console.error('[analyzePayrollDocument] error inesperado:', err);
        }
    }
    let usage;
    try {
        usage = await getUsageSnapshot();
    }
    catch (err) {
        console.warn('[analyzePayrollDocument] getUsageSnapshot falló:', err);
    }
    return {
        kind: data.kind,
        extracted,
        extractionFailed,
        provider,
        fallbackUsed,
        usage,
    };
});
//# sourceMappingURL=analyze-payroll-document.js.map