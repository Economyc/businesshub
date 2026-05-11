// Helper genérico de extracción estructurada con cadena de fallback.
// Estrategia:
//   1) Vision providers (Gemini, Groq Scout si está) — leen archivo binario directo
//   2) Si todos los vision fallan y es PDF → pdf-parse extrae texto → text-only
//      providers (Cerebras) lo procesan como string
//   3) Si todo falla → ExtractionFailedError con detalle por proveedor
//
// El caller decide qué hacer con el error: típicamente devuelve
// extractionFailed=true al cliente para que muestre toast y permita
// llenar manualmente.
import { generateObject } from 'ai';
import { isRateLimitError, parseRetryAfter } from './llm-router.js';
export class ExtractionFailedError extends Error {
    attempts;
    constructor(attempts) {
        const summary = attempts.map((a) => `${a.provider}: ${a.error}`).join(' | ');
        super(`All AI providers failed: ${summary}`);
        this.attempts = attempts;
        this.name = 'ExtractionFailedError';
    }
}
/**
 * Intenta extraer datos estructurados de un archivo (imagen o PDF) usando
 * la cadena Gemini → Groq Scout → (PDF only) pdf-parse → Cerebras.
 *
 * Lanza ExtractionFailedError si todos los proveedores fallan.
 */
export async function extractWithFallback(params) {
    const { router, schema, prompt, fileBase64, mimeType, maxVisionAttempts = 3, maxTextAttempts = 3, } = params;
    const isPdf = mimeType === 'application/pdf';
    const attempts = [];
    let isPrimary = true;
    // ── Fase 1: vision providers ──────────────────────────────────────
    for (let i = 0; i < maxVisionAttempts; i++) {
        let modelInfo;
        try {
            modelInfo = await router.getModel({ needsVision: true });
        }
        catch {
            // No hay vision providers disponibles (todos rate-limited o no configurados)
            break;
        }
        try {
            const result = await generateObject({
                model: modelInfo.model,
                schema,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'file', data: fileBase64, mimeType },
                        ],
                    },
                ],
            });
            return {
                object: result.object,
                provider: modelInfo.provider,
                fallbackUsed: !isPrimary,
            };
        }
        catch (err) {
            const errMsg = err.message ?? String(err);
            attempts.push({ provider: modelInfo.provider, error: errMsg });
            console.warn(`[extractWithFallback] ${modelInfo.provider} failed:`, errMsg);
            if (isRateLimitError(err)) {
                await router.markRateLimited(modelInfo.provider, parseRetryAfter(err), 'extraction 429');
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
    if (isPdf) {
        let pdfText;
        try {
            // Import dinámico para no penalizar cold start cuando solo es imagen.
            const { PDFParse } = await import('pdf-parse');
            const buffer = Buffer.from(fileBase64, 'base64');
            const parser = new PDFParse({ data: new Uint8Array(buffer) });
            const result = await parser.getText();
            await parser.destroy();
            pdfText = (result.text ?? '').trim();
        }
        catch (err) {
            const errMsg = err.message ?? String(err);
            attempts.push({ provider: 'pdf-parse', error: errMsg });
            throw new ExtractionFailedError(attempts);
        }
        if (!pdfText) {
            attempts.push({
                provider: 'pdf-parse',
                error: 'PDF sin texto extraíble (probablemente escaneado o solo imágenes)',
            });
            throw new ExtractionFailedError(attempts);
        }
        // Truncar texto muy largo para no exceder context windows pequeños (Cerebras 8B = 8K tokens).
        // 20K chars ≈ 5K tokens, deja espacio para prompt + schema + output.
        const truncated = pdfText.length > 20_000 ? pdfText.slice(0, 20_000) + '\n[...truncado]' : pdfText;
        for (let i = 0; i < maxTextAttempts; i++) {
            let modelInfo;
            try {
                modelInfo = await router.getModel({ needsVision: false });
            }
            catch {
                break;
            }
            try {
                const result = await generateObject({
                    model: modelInfo.model,
                    schema,
                    messages: [
                        {
                            role: 'user',
                            content: `${prompt}\n\nTexto extraído del PDF (puede estar desordenado por columnas):\n\n${truncated}`,
                        },
                    ],
                });
                return {
                    object: result.object,
                    provider: `${modelInfo.provider}+pdf-parse`,
                    fallbackUsed: true,
                };
            }
            catch (err) {
                const errMsg = err.message ?? String(err);
                attempts.push({ provider: modelInfo.provider, error: errMsg });
                console.warn(`[extractWithFallback] ${modelInfo.provider} (text) failed:`, errMsg);
                if (isRateLimitError(err)) {
                    await router.markRateLimited(modelInfo.provider, parseRetryAfter(err), 'extraction 429');
                    continue;
                }
                await router.markRateLimited(modelInfo.provider, 30_000, 'extraction error');
            }
        }
    }
    throw new ExtractionFailedError(attempts);
}
//# sourceMappingURL=extract-with-fallback.js.map