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
    /**
     * Instante límite (epoch ms) de TODA la cadena. Al pasarse se lanza
     * ExtractionBudgetExceededError en vez de arrancar otro intento.
     */
    deadlineAt?: number;
    /**
     * Corte por intento contra un proveedor. Al vencer se aborta el request en
     * curso y se releva al siguiente slot de la cadena.
     */
    attemptTimeoutMs?: number;
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
/** Texto plano: sin imagen los modelos responden en 2-6s; 15s ya es anomalía. */
export declare const TEXT_ATTEMPT_TIMEOUT_MS = 15000;
/** Por debajo de esto no vale la pena arrancar un intento: no cabe entero. */
export declare const MIN_ATTEMPT_MS = 6000;
/**
 * Un provider que hoy no respondió a tiempo sigue lento en la request siguiente.
 * Apagarlo un rato hace que el resto del lote vaya derecho al relevo en vez de
 * pagar 20s de peaje por documento — importa en la subida masiva de facturas.
 */
export declare const SLOW_PROVIDER_COOLDOWN_MS: number;
/**
 * Se agotó el presupuesto de tiempo antes de que ningún proveedor contestara.
 * Existe para NUNCA llegar al timeout del contenedor: un 504 de Cloud Run llega
 * sin cabecera CORS y el navegador lo reporta como un error de CORS que no
 * tiene nada que ver (mismo despiste que el bug de Drive de 2026-07-16).
 */
export declare class ExtractionBudgetExceededError extends Error {
    attempts: AttemptRecord[];
    constructor(attempts: AttemptRecord[]);
}
/** ¿El error es nuestro corte por tiempo? El AI SDK re-lanza los abort tal cual. */
export declare function isAbortError(err: unknown): boolean;
/**
 * Cuánto tiempo le queda al intento: el mínimo entre lo que resta del
 * presupuesto global y el corte por intento.
 */
export declare function attemptBudgetMs(deadlineAt: number, attemptTimeoutMs: number): number;
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