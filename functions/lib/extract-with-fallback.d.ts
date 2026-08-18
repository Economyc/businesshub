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
    /** Máximo de proveedores text-only a intentar (PDF text o image OCR). Default 3. */
    maxTextAttempts?: number;
    /**
     * Predicado opcional: ¿la extracción salió "vacía" (sin datos útiles)?
     * Si se provee y un PDF leído con pdf-parse da un resultado vacío, el helper
     * escala a Cloud Vision OCR (texto mejor maquetado) y reintenta, en vez de
     * devolver el vacío. También se usa al final para lanzar (en vez de devolver
     * vacío) y que el caller muestre el aviso de fallo. Default: nunca vacío.
     */
    isResultEmpty?: (obj: T) => boolean;
}
interface ExtractResult<T> {
    object: T;
    /** Provider que tuvo éxito. Ej: 'gemini', 'groq-qwen', 'groq-gptoss+pdf-parse', 'cerebras-gptoss+vision-ocr' */
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
 * Traduce un fallo total de la cadena a un motivo entendible por el usuario.
 * Sin esto el cliente sólo puede decir "no se pudo leer", y una caída por saldo
 * o por un modelo retirado se ve igual que un documento borroso — que fue
 * exactamente lo que dejó el lector roto durante 5 días sin que nadie lo notara.
 */
export declare function describeExtractionFailure(err: unknown): string;
/**
 * Intenta extraer datos estructurados de un archivo (imagen o PDF) usando
 * la cadena Gemini → Groq Scout (sólo imágenes) → (PDF) pdf-parse → text-only
 *                                                → (imagen) Cloud Vision OCR → text-only.
 *
 * Lanza ExtractionFailedError si todos los proveedores fallan.
 */
export declare function extractWithFallback<T>(params: ExtractParams<T>): Promise<ExtractResult<T>>;
export {};
//# sourceMappingURL=extract-with-fallback.d.ts.map