import type { LanguageModelV1 } from 'ai';
/**
 * LLM Router with automatic fallback between free providers.
 * Persists rate limits in Firestore so cooldowns survive cold starts; keeps a short
 * in-memory cache (30s TTL) and an in-memory fallback if Firestore is unreachable.
 */
export declare class LLMRouter {
    private providers;
    /** Cache local: provider → { until, cachedAt }. También sirve de fallback. */
    private cache;
    addGemini(apiKey: string): this;
    addGroq(apiKey: string): this;
    addCerebras(apiKey: string): this;
    /**
     * Lee el estado de rate-limit de todos los providers (cache local + Firestore en paralelo).
     * Si Firestore falla, cae al cache local existente. Nunca rompe el chat.
     */
    private loadRateLimits;
    /**
     * Get the best available model. Skips rate-limited providers.
     * If the request includes images, only returns vision-capable models.
     * Si needsPdfNative=true, solo devuelve providers que pueden leer PDFs como input
     * (excluye groq-scout que solo lee imágenes).
     * Si `exclude` está presente, salta esos providers (útil para iterar dentro de una
     * misma request sin marcarlos rate-limited).
     */
    getModel(options?: {
        needsVision?: boolean;
        needsPdfNative?: boolean;
        exclude?: ReadonlySet<string>;
    }): Promise<{
        model: LanguageModelV1;
        provider: string;
    }>;
    /**
     * Mark a provider as rate-limited. Persiste en Firestore + actualiza cache local.
     * Si Firestore falla, mantiene el rate-limit sólo en memoria (fallback silencioso).
     */
    markRateLimited(providerName: string, cooldownMs?: number, reason?: string): Promise<void>;
    /**
     * Get status of all providers for debugging.
     */
    getStatus(): Promise<{
        name: string;
        available: boolean;
        supportsVision: boolean;
        cooldownRemaining: number;
    }[]>;
}
/**
 * Detecta errores de "no hay saldo / créditos agotados / sin quota prepagada".
 * Estos NO se recuperan en minutos — necesitan acción manual (topup). Cuando
 * pasan aplicamos un cooldown largo para no quemar el chain entero en cada
 * request mientras el dueño recarga.
 */
export declare function isCreditDepletedError(error: unknown): boolean;
/**
 * Check if a streamText error is a rate limit error (HTTP 429).
 */
export declare function isRateLimitError(error: unknown): boolean;
/**
 * Parse retry-after header from error, returns milliseconds.
 */
export declare function parseRetryAfter(error: unknown): number;
/**
 * Check if messages contain image content (for vision routing).
 */
export declare function messagesContainImages(messages: unknown[]): boolean;
//# sourceMappingURL=llm-router.d.ts.map