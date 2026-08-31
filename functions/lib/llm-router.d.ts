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
    addGemini(apiKey: string, opts?: {
        name?: string;
        modelId?: string;
    }): this;
    /**
     * Segunda key de Google, esta con facturación. Se registra DESPUÉS de
     * addGemini, así que sólo entra cuando la gratis quedó marcada (cuota diaria
     * agotada o error). Es el único relevo que lee PDFs nativos: sin ella un PDF
     * cae a OCR + modelo de texto y falla bastante más.
     */
    addGeminiPaid(apiKey: string, opts?: {
        modelId?: string;
    }): this;
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
     * (excluye groq-qwen que solo lee imágenes).
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
 * Cuánto esperar antes de volver a probar el provider, en ms.
 *
 * Dos bugs que tenía esta función y por qué importan: leía `headers`, pero el
 * APICallError del AI SDK expone `responseHeaders` — el Retry-After no se
 * encontraba NUNCA y siempre caía al default de 60s. Y Google no manda
 * Retry-After: pone el RetryInfo dentro del body ("retryDelay":"42s"), que es
 * el dato que de verdad sirve para saber cuándo vuelve a estar disponible.
 */
export declare function parseRetryAfter(error: unknown): number;
/**
 * Check if messages contain image content (for vision routing).
 */
export declare function messagesContainImages(messages: unknown[]): boolean;
/**
 * Modelo de Gemini para la lectura de documentos. NO es 'gemini-2.5-flash':
 * Google dejó de habilitarlo en proyectos nuevos ("no longer available to new
 * users"), así que la key del free tier responde 404 con ese id. 3.6-flash sí
 * funciona con las dos keys, y usar el mismo en ambas evita que la extracción
 * se comporte distinto según cuál esté atendiendo.
 */
export declare const DOC_GEMINI_MODEL = "gemini-3.6-flash";
/**
 * ¿El 429 viene de la cuota DIARIA y no del límite por minuto? Google lo
 * distingue en el nombre de la métrica que devuelve (…PerDay… vs …PerMinute…).
 * Sólo devolvemos true con la marca explícita: un falso positivo apaga el
 * provider gratis hasta la madrugada siguiente.
 */
export declare function isDailyQuotaError(error: unknown): boolean;
/**
 * ms hasta la próxima medianoche del Pacífico, que es cuando Google resetea las
 * cuotas diarias (≈ 2:00 a.m. en Bogotá), más un minuto de colchón. El día del
 * cambio de horario dura 23 o 25 h; si nos quedamos cortos el siguiente 429
 * vuelve a marcar el cooldown, así que no hace falta más precisión.
 */
export declare function msUntilPacificMidnight(now?: Date): number;
//# sourceMappingURL=llm-router.d.ts.map