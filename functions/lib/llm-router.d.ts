import type { LanguageModelV1 } from 'ai';
/**
 * LLM Router with automatic fallback between free providers.
 * Tracks rate limits in-memory and skips providers that are cooling down.
 */
export declare class LLMRouter {
    private providers;
    addGemini(apiKey: string): this;
    addGroq(apiKey: string): this;
    /**
     * Get the best available model. Skips rate-limited providers.
     * If the request includes images, only returns vision-capable models.
     */
    getModel(options?: {
        needsVision?: boolean;
    }): {
        model: LanguageModelV1;
        provider: string;
    };
    /**
     * Mark a provider as rate-limited. Call this when a 429 error is received.
     */
    markRateLimited(providerName: string, cooldownMs?: number): void;
    /**
     * Get status of all providers for debugging.
     */
    getStatus(): {
        name: string;
        available: boolean;
        supportsVision: boolean;
        cooldownRemaining: number;
    }[];
}
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