import type { z } from 'zod';
import { LLMRouter } from './llm-router.js';
interface ExtractParams<T> {
    router: LLMRouter;
    schema: z.ZodSchema<T>;
    /** Prompt de extracción (sin el archivo). El helper agrega el archivo o el texto del PDF. */
    prompt: string;
    fileBase64: string;
    mimeType: string;
    /** Máximo de proveedores vision a intentar antes de caer a text-only. Default 3. */
    maxVisionAttempts?: number;
    /** Máximo de proveedores text-only a intentar (solo aplica para PDFs). Default 3. */
    maxTextAttempts?: number;
}
interface ExtractResult<T> {
    object: T;
    /** Provider que tuvo éxito. Ej: 'gemini', 'groq-scout', 'cerebras-llama8b+pdf-parse' */
    provider: string;
    /** True si tuvo que caer a un proveedor secundario (no fue el primario). */
    fallbackUsed: boolean;
}
interface AttemptRecord {
    provider: string;
    error: string;
}
export declare class ExtractionFailedError extends Error {
    attempts: AttemptRecord[];
    constructor(attempts: AttemptRecord[]);
}
/**
 * Intenta extraer datos estructurados de un archivo (imagen o PDF) usando
 * la cadena Gemini → Groq Scout → (PDF only) pdf-parse → Cerebras.
 *
 * Lanza ExtractionFailedError si todos los proveedores fallan.
 */
export declare function extractWithFallback<T>(params: ExtractParams<T>): Promise<ExtractResult<T>>;
export {};
//# sourceMappingURL=extract-with-fallback.d.ts.map