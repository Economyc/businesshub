// Helper genérico de extracción estructurada con cadena de fallback.
// Estrategia (orden de intento):
//   Fase 1 — Vision providers (Gemini, Groq Scout):
//     * Gemini recibe el archivo como { type: 'file' } (PDF o imagen).
//     * Groq Scout sólo se usa para imágenes (no soporta PDFs nativos) y
//       recibe el contenido como { type: 'image' } con data URL base64.
//   Fase 2 — Si el archivo es PDF y la fase 1 falló:
//     * pdf-parse extrae texto embebido → Cerebras / Groq-llama70b lo procesan.
//     * Si pdf-parse no devuelve texto (PDF escaneado), Cloud Vision PDF OCR
//       extrae texto como último recurso → text-only providers.
//   Fase 3 — Si el archivo es imagen y la fase 1 falló:
//     * Google Cloud Vision OCR extrae texto → text-only providers
//       (Cerebras / Groq-llama70b) lo procesan.
//   Si todo falla → ExtractionFailedError con detalle por proveedor.
//
// El caller decide qué hacer con el error: típicamente devuelve
// extractionFailed=true al cliente para que muestre toast y permita
// llenar manualmente.
import { generateObject } from 'ai';
import { isRateLimitError, isCreditDepletedError, isDailyQuotaError, msUntilPacificMidnight, parseRetryAfter, } from './llm-router.js';
import { ocrImageBase64, ocrPdfBase64 } from './cloud-vision-ocr.js';
import { recordUsage, providerToField } from './ai-usage-stats.js';
export class ExtractionFailedError extends Error {
    attempts;
    constructor(attempts) {
        const summary = attempts.map((a) => `${a.provider}: ${a.error}`).join(' | ');
        super(`All AI providers failed: ${summary}`);
        this.attempts = attempts;
        this.name = 'ExtractionFailedError';
    }
}
/** Cooldown largo cuando un provider se quedó sin créditos prepagados. */
const CREDITS_DEPLETED_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 horas
/**
 * Corte por intento. Medido en Cloud Logging (20 jul–19 ago vs. 19–31 ago): con
 * la key gratis de Gemini de primera, la lectura pasó de p50 4,5s / máx 21s a
 * p50 12s / p90 32s / máx 110s. A los 20s ya contestaron ~3 de cada 4 lecturas,
 * así que cortar ahí conserva el caso bueno (gratis y rápido) y le ahorra al
 * usuario la cola de 50-110s: 20s de peaje + ~7s de la key paga < 30s.
 */
const DEFAULT_ATTEMPT_TIMEOUT_MS = 20_000;
/** Texto plano: sin imagen los modelos responden en 2-6s; 15s ya es anomalía. */
export const TEXT_ATTEMPT_TIMEOUT_MS = 15_000;
/** Por debajo de esto no vale la pena arrancar un intento: no cabe entero. */
export const MIN_ATTEMPT_MS = 6_000;
/**
 * Un provider que hoy no respondió a tiempo sigue lento en la request siguiente.
 * Apagarlo un rato hace que el resto del lote vaya derecho al relevo en vez de
 * pagar 20s de peaje por documento — importa en la subida masiva de facturas.
 */
export const SLOW_PROVIDER_COOLDOWN_MS = 3 * 60_000;
/**
 * Se agotó el presupuesto de tiempo antes de que ningún proveedor contestara.
 * Existe para NUNCA llegar al timeout del contenedor: un 504 de Cloud Run llega
 * sin cabecera CORS y el navegador lo reporta como un error de CORS que no
 * tiene nada que ver (mismo despiste que el bug de Drive de 2026-07-16).
 */
export class ExtractionBudgetExceededError extends Error {
    attempts;
    constructor(attempts) {
        const summary = attempts.map((a) => `${a.provider}: ${a.error}`).join(' | ');
        super(`Extraction budget exceeded: ${summary}`);
        this.attempts = attempts;
        this.name = 'ExtractionBudgetExceededError';
    }
}
/**
 * Corta la cadena si ya no queda presupuesto para otra fase. Se llama antes de
 * los pasos caros (Cloud Vision, tandas de text-only) para que la respuesta la
 * demos nosotros y no el timeout del contenedor.
 */
function assertBudget(deadlineAt, attempts) {
    if (deadlineAt - Date.now() < MIN_ATTEMPT_MS) {
        trackFailure();
        throw new ExtractionBudgetExceededError(attempts);
    }
}
/** ¿El error es nuestro corte por tiempo? El AI SDK re-lanza los abort tal cual. */
export function isAbortError(err) {
    return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}
/**
 * Cuánto tiempo le queda al intento: el mínimo entre lo que resta del
 * presupuesto global y el corte por intento.
 */
export function attemptBudgetMs(deadlineAt, attemptTimeoutMs) {
    return Math.min(attemptTimeoutMs, deadlineAt - Date.now());
}
/**
 * Traduce un fallo total de la cadena a un motivo entendible por el usuario.
 * Sin esto el cliente sólo puede decir "no se pudo leer", y una caída por saldo
 * o por un modelo retirado se ve igual que un documento borroso — que fue
 * exactamente lo que dejó el lector roto durante 5 días sin que nadie lo notara.
 */
export function describeExtractionFailure(err) {
    if (err instanceof ExtractionBudgetExceededError) {
        return 'La IA está respondiendo muy lento en este momento y no alcanzó a leer el documento.';
    }
    const attempts = err instanceof ExtractionFailedError ? err.attempts : [];
    const errors = attempts.map((a) => new Error(a.error));
    if (errors.some(isCreditDepletedError)) {
        return 'El servicio de IA se quedó sin saldo. Avísale al administrador para que lo recargue.';
    }
    if (errors.some((e) => /does not exist|do not have access|not found/i.test(e.message))) {
        return 'El modelo de IA configurado ya no está disponible y hay que actualizarlo.';
    }
    if (errors.some(isRateLimitError)) {
        return 'El servicio de IA alcanzó su límite de uso. Intenta de nuevo en unos minutos.';
    }
    const msg = err instanceof Error ? err.message : '';
    if (/rate-limited or unavailable/i.test(msg)) {
        return 'Todos los proveedores de IA están temporalmente fuera de servicio. Intenta más tarde.';
    }
    return 'No pudimos leer el documento. Puede estar borroso o en un formato que la IA no entiende.';
}
/** Telemetría fire-and-forget de éxito por provider. No bloquea la respuesta. */
function trackSuccess(provider) {
    const field = providerToField(provider);
    if (field)
        void recordUsage(field);
    void recordUsage('totalExtractions');
}
/** Telemetría fire-and-forget de fallo total del chain. */
function trackFailure() {
    void recordUsage('totalFailed');
}
/**
 * Construye el content array para `generateObject` según el provider y el tipo
 * de archivo. Groq y Gemini esperan formatos distintos.
 */
function buildContent(provider, prompt, fileBase64, mimeType) {
    // Groq sólo entiende imágenes vía content type 'image' con data URL.
    if (provider === 'groq-qwen') {
        return [
            { type: 'text', text: prompt },
            { type: 'image', image: `data:${mimeType};base64,${fileBase64}` },
        ];
    }
    // Gemini (y cualquier otro provider que se agregue con file-input nativo).
    return [
        { type: 'text', text: prompt },
        { type: 'file', data: fileBase64, mimeType },
    ];
}
/**
 * Llama a un provider text-only con un prompt + texto adjunto y devuelve el resultado
 * parseado por el schema. Maneja rate-limit y errores de créditos.
 */
async function tryTextOnlyProviders(router, schema, prompt, textBody, textSourceLabel, maxAttempts, attempts, deadlineAt) {
    const tried = new Set();
    for (let i = 0; i < maxAttempts; i++) {
        const attemptMs = attemptBudgetMs(deadlineAt, TEXT_ATTEMPT_TIMEOUT_MS);
        if (attemptMs < MIN_ATTEMPT_MS)
            break;
        let modelInfo;
        try {
            modelInfo = await router.getModel({ needsVision: false, exclude: tried });
        }
        catch {
            break;
        }
        tried.add(modelInfo.provider);
        const startedAt = Date.now();
        try {
            const result = await generateObject({
                model: modelInfo.model,
                schema,
                // El router YA es el mecanismo de reintento (pasa al siguiente
                // proveedor). El del SDK lo duplica: 3 requests y 6s de sleep puro
                // (2s+4s) por slot antes de que nos enteremos del fallo, y envuelve el
                // error original en un RetryError que rompe la deteccion de cuota.
                maxRetries: 0,
                abortSignal: AbortSignal.timeout(attemptMs),
                messages: [
                    {
                        role: 'user',
                        content: `${prompt}\n\nTexto extraído (puede estar desordenado por columnas):\n\n${textBody}`,
                    },
                ],
            });
            trackSuccess(modelInfo.provider);
            return {
                object: result.object,
                provider: `${modelInfo.provider}+${textSourceLabel}`,
            };
        }
        catch (err) {
            const timedOut = isAbortError(err);
            const errMsg = timedOut
                ? `sin respuesta en ${attemptMs}ms`
                : (err.message ?? String(err));
            attempts.push({ provider: modelInfo.provider, error: errMsg });
            console.warn(`[extractWithFallback] ${modelInfo.provider} (text) failed (${Date.now() - startedAt}ms):`, errMsg);
            if (timedOut) {
                await router.markRateLimited(modelInfo.provider, SLOW_PROVIDER_COOLDOWN_MS, 'timeout de intento');
                continue;
            }
            if (isCreditDepletedError(err)) {
                await router.markRateLimited(modelInfo.provider, CREDITS_DEPLETED_COOLDOWN_MS, 'credits depleted');
                continue;
            }
            if (isRateLimitError(err)) {
                // Un 429 por cuota DIARIA no se recupera en un minuto: si lo tratamos
                // como límite por minuto, cada lectura del resto del día quema un
                // intento condenado a fallar antes de pasar al siguiente provider.
                const daily = isDailyQuotaError(err);
                await router.markRateLimited(modelInfo.provider, daily ? msUntilPacificMidnight() : parseRetryAfter(err), daily ? 'cuota diaria agotada' : 'extraction 429');
                continue;
            }
            await router.markRateLimited(modelInfo.provider, 30_000, 'extraction error');
        }
    }
    return null;
}
/**
 * Intenta extraer datos estructurados de un archivo (imagen o PDF) usando
 * la cadena Gemini → Groq Scout (sólo imágenes) → (PDF) pdf-parse → text-only
 *                                                → (imagen) Cloud Vision OCR → text-only.
 *
 * Lanza ExtractionFailedError si todos los proveedores fallan.
 */
export async function extractWithFallback(params) {
    const { router, schema, prompt, fileBase64, mimeType, maxVisionAttempts = 3, maxTextAttempts = 3, isResultEmpty = () => false, deadlineAt = Infinity, attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS, } = params;
    const isPdf = mimeType === 'application/pdf';
    const isImage = mimeType.startsWith('image/');
    const attempts = [];
    let isPrimary = true;
    // ── Fase 1: vision providers ──────────────────────────────────────
    const triedVision = new Set();
    for (let i = 0; i < maxVisionAttempts; i++) {
        const attemptMs = attemptBudgetMs(deadlineAt, attemptTimeoutMs);
        if (attemptMs < MIN_ATTEMPT_MS)
            break;
        let modelInfo;
        try {
            modelInfo = await router.getModel({
                needsVision: true,
                // Si es PDF, sólo aceptamos providers con soporte PDF nativo (Gemini).
                needsPdfNative: isPdf,
                exclude: triedVision,
            });
        }
        catch {
            // No quedan vision providers viables — pasar a fase 2/3.
            break;
        }
        triedVision.add(modelInfo.provider);
        const startedAt = Date.now();
        try {
            const result = await generateObject({
                model: modelInfo.model,
                schema,
                // Ver el comentario de tryTextOnlyProviders: el fallback lo hace el
                // router, el retry del SDK solo agrega 6s de sleep por proveedor.
                maxRetries: 0,
                abortSignal: AbortSignal.timeout(attemptMs),
                messages: [
                    {
                        role: 'user',
                        content: buildContent(modelInfo.provider, prompt, fileBase64, mimeType),
                    },
                ],
            });
            trackSuccess(modelInfo.provider);
            console.log(`[extractWithFallback] ${modelInfo.provider} ok en ${Date.now() - startedAt}ms`);
            return {
                object: result.object,
                provider: modelInfo.provider,
                fallbackUsed: !isPrimary,
            };
        }
        catch (err) {
            const timedOut = isAbortError(err);
            const errMsg = timedOut
                ? `sin respuesta en ${attemptMs}ms`
                : (err.message ?? String(err));
            attempts.push({ provider: modelInfo.provider, error: errMsg });
            console.warn(`[extractWithFallback] ${modelInfo.provider} failed (${Date.now() - startedAt}ms):`, errMsg);
            if (timedOut) {
                await router.markRateLimited(modelInfo.provider, SLOW_PROVIDER_COOLDOWN_MS, 'timeout de intento');
                isPrimary = false;
                continue;
            }
            if (isCreditDepletedError(err)) {
                await router.markRateLimited(modelInfo.provider, CREDITS_DEPLETED_COOLDOWN_MS, 'credits depleted');
                isPrimary = false;
                continue;
            }
            if (isRateLimitError(err)) {
                // Un 429 por cuota DIARIA no se recupera en un minuto: si lo tratamos
                // como límite por minuto, cada lectura del resto del día quema un
                // intento condenado a fallar antes de pasar al siguiente provider.
                const daily = isDailyQuotaError(err);
                await router.markRateLimited(modelInfo.provider, daily ? msUntilPacificMidnight() : parseRetryAfter(err), daily ? 'cuota diaria agotada' : 'extraction 429');
                isPrimary = false;
                continue;
            }
            // Para errores no-429 (safety filter, schema mismatch, timeout) también
            // marcamos cooldown corto para no quemar el provider en cada request.
            await router.markRateLimited(modelInfo.provider, 30_000, 'extraction error');
            isPrimary = false;
        }
    }
    // ── Fase 2: PDF → texto → text-only providers ─────────────────────
    // Orden: pdf-parse (local, gratis) primero; si su texto no alcanza para
    // extraer datos (PDF escaneado, o texto mal maquetado por columnas que
    // confunde al modelo), escalamos a Cloud Vision OCR (texto mejor ordenado)
    // y reintentamos. Cloud Vision SOLO se usa cuando pdf-parse no dio resultado
    // útil — así no se gasta OCR cuando no hace falta.
    if (isPdf) {
        assertBudget(deadlineAt, attempts);
        // 2a — texto embebido vía pdf-parse. La mayoría de facturas genéricas son
        // PDFs con texto, así que esto las resuelve sin tocar Cloud Vision.
        let pdfText = '';
        try {
            // Import dinámico para no penalizar cold start cuando solo es imagen.
            const { PDFParse } = await import('pdf-parse');
            const buffer = Buffer.from(fileBase64, 'base64');
            const parser = new PDFParse({ data: new Uint8Array(buffer) });
            try {
                const result = await parser.getText();
                pdfText = (result.text ?? '').trim();
            }
            finally {
                // Liberar el parser aunque getText() lance (PDF corrupto/cifrado).
                await parser.destroy();
            }
        }
        catch (err) {
            const errMsg = err.message ?? String(err);
            attempts.push({ provider: 'pdf-parse', error: errMsg });
            // No lanzamos: caemos a Cloud Vision OCR abajo.
        }
        if (pdfText) {
            // Truncar texto muy largo para no exceder context windows pequeños (Cerebras 8B = 8K tokens).
            const truncated = pdfText.length > 20_000 ? pdfText.slice(0, 20_000) + '\n[...truncado]' : pdfText;
            const success = await tryTextOnlyProviders(router, schema, prompt, truncated, 'pdf-parse', maxTextAttempts, attempts, deadlineAt);
            if (success && !isResultEmpty(success.object)) {
                return { object: success.object, provider: success.provider, fallbackUsed: true };
            }
            // pdf-parse dio texto pero el modelo no extrajo datos (texto pobre o mal
            // maquetado). Escalamos a Cloud Vision OCR para reintentar con texto mejor.
            if (success) {
                attempts.push({
                    provider: 'pdf-parse',
                    error: 'extracción vacía (texto mal maquetado), escalando a Cloud Vision OCR',
                });
                console.warn('[extractWithFallback] pdf-parse dio extracción vacía, escalando a Cloud Vision OCR');
            }
        }
        // 2b — Cloud Vision OCR: PDF escaneado (pdf-parse vacío) o texto pobre
        // (extracción vacía). Da texto mejor maquetado → reintento.
        assertBudget(deadlineAt, attempts);
        void recordUsage('cloudVisionOcr');
        let ocrText;
        try {
            ocrText = await ocrPdfBase64(fileBase64);
        }
        catch (err) {
            const errMsg = err.message ?? String(err);
            attempts.push({ provider: 'cloud-vision-ocr', error: errMsg });
            trackFailure();
            throw new ExtractionFailedError(attempts);
        }
        if (!ocrText) {
            attempts.push({
                provider: 'cloud-vision-ocr',
                error: 'PDF sin texto detectable por OCR',
            });
            trackFailure();
            throw new ExtractionFailedError(attempts);
        }
        const truncated = ocrText.length > 20_000 ? ocrText.slice(0, 20_000) + '\n[...truncado]' : ocrText;
        const success = await tryTextOnlyProviders(router, schema, prompt, truncated, 'vision-ocr', maxTextAttempts, attempts, deadlineAt);
        if (success && !isResultEmpty(success.object)) {
            return { object: success.object, provider: success.provider, fallbackUsed: true };
        }
        // Ni con OCR salieron datos → fallo real (el caller muestra el aviso).
        if (success) {
            attempts.push({ provider: 'vision-ocr', error: 'extracción vacía aun con OCR' });
        }
        trackFailure();
        throw new ExtractionFailedError(attempts);
    }
    // ── Fase 3: imagen → Cloud Vision OCR → text-only providers ───────
    if (isImage) {
        assertBudget(deadlineAt, attempts);
        let ocrText;
        // Contamos contra el free tier antes de invocar — si el shot va a llegar
        // a Cloud Vision aunque luego falle el parsing, igual nos cobra el OCR.
        void recordUsage('cloudVisionOcr');
        try {
            ocrText = await ocrImageBase64(fileBase64);
        }
        catch (err) {
            const errMsg = err.message ?? String(err);
            attempts.push({ provider: 'cloud-vision-ocr', error: errMsg });
            trackFailure();
            throw new ExtractionFailedError(attempts);
        }
        if (!ocrText) {
            attempts.push({
                provider: 'cloud-vision-ocr',
                error: 'Imagen sin texto detectable',
            });
            trackFailure();
            throw new ExtractionFailedError(attempts);
        }
        const truncated = ocrText.length > 20_000 ? ocrText.slice(0, 20_000) + '\n[...truncado]' : ocrText;
        const success = await tryTextOnlyProviders(router, schema, prompt, truncated, 'vision-ocr', maxTextAttempts, attempts, deadlineAt);
        if (success) {
            return { object: success.object, provider: success.provider, fallbackUsed: true };
        }
        trackFailure();
        throw new ExtractionFailedError(attempts);
    }
    trackFailure();
    throw new ExtractionFailedError(attempts);
}
//# sourceMappingURL=extract-with-fallback.js.map