import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createCerebras } from '@ai-sdk/cerebras';
/**
 * LLM Router with automatic fallback between free providers.
 * Tracks rate limits in-memory and skips providers that are cooling down.
 */
export class LLMRouter {
    providers = [];
    addGemini(apiKey) {
        if (!apiKey)
            return this;
        const google = createGoogleGenerativeAI({ apiKey });
        this.providers.push({
            name: 'gemini',
            createModel: () => google('gemini-2.5-flash'),
            supportsVision: true,
            rateLimitedUntil: 0,
        });
        return this;
    }
    addGroq(apiKey) {
        if (!apiKey)
            return this;
        const groq = createGroq({ apiKey });
        // Add vision-capable model first
        this.providers.push({
            name: 'groq-scout',
            createModel: () => groq('meta-llama/llama-4-scout-17b-16e-instruct'),
            supportsVision: true,
            rateLimitedUntil: 0,
        });
        // Add text-only model as additional fallback
        this.providers.push({
            name: 'groq-llama70b',
            createModel: () => groq('llama-3.3-70b-versatile'),
            supportsVision: false,
            rateLimitedUntil: 0,
        });
        return this;
    }
    addCerebras(apiKey) {
        if (!apiKey)
            return this;
        const cerebras = createCerebras({ apiKey });
        this.providers.push({
            name: 'cerebras-llama8b',
            createModel: () => cerebras('llama-3.1-8b'),
            supportsVision: false,
            rateLimitedUntil: 0,
        });
        return this;
    }
    /**
     * Get the best available model. Skips rate-limited providers.
     * If the request includes images, only returns vision-capable models.
     */
    getModel(options) {
        const now = Date.now();
        const needsVision = options?.needsVision ?? false;
        for (const provider of this.providers) {
            // Skip rate-limited providers
            if (provider.rateLimitedUntil > now) {
                console.log(`[LLMRouter] Skipping ${provider.name} (rate limited until ${new Date(provider.rateLimitedUntil).toISOString()})`);
                continue;
            }
            // Skip non-vision providers if vision is needed
            if (needsVision && !provider.supportsVision) {
                continue;
            }
            return { model: provider.createModel(), provider: provider.name };
        }
        throw new Error('All AI providers are rate-limited or unavailable. Please try again in a minute.');
    }
    /**
     * Mark a provider as rate-limited. Call this when a 429 error is received.
     */
    markRateLimited(providerName, cooldownMs = 60_000) {
        const provider = this.providers.find((p) => p.name === providerName);
        if (provider) {
            provider.rateLimitedUntil = Date.now() + cooldownMs;
            console.warn(`[LLMRouter] ${providerName} rate limited for ${cooldownMs}ms`);
        }
    }
    /**
     * Get status of all providers for debugging.
     */
    getStatus() {
        const now = Date.now();
        return this.providers.map((p) => ({
            name: p.name,
            available: p.rateLimitedUntil <= now,
            supportsVision: p.supportsVision,
            cooldownRemaining: Math.max(0, p.rateLimitedUntil - now),
        }));
    }
}
/**
 * Check if a streamText error is a rate limit error (HTTP 429).
 */
export function isRateLimitError(error) {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
            return true;
        }
    }
    if (typeof error === 'object' && error !== null) {
        const statusCode = error.status ?? error.statusCode;
        if (statusCode === 429)
            return true;
    }
    return false;
}
/**
 * Parse retry-after header from error, returns milliseconds.
 */
export function parseRetryAfter(error) {
    if (typeof error === 'object' && error !== null) {
        const headers = error.headers;
        const retryAfter = headers?.['retry-after'];
        if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds))
                return seconds * 1000;
        }
    }
    return 60_000; // Default 1 minute
}
/**
 * Check if messages contain image content (for vision routing).
 */
export function messagesContainImages(messages) {
    for (const msg of messages) {
        if (typeof msg !== 'object' || msg === null)
            continue;
        const content = msg.content;
        if (Array.isArray(content)) {
            for (const part of content) {
                if (typeof part === 'object' && part !== null) {
                    const type = part.type;
                    if (type === 'image' || type === 'file')
                        return true;
                }
            }
        }
    }
    return false;
}
//# sourceMappingURL=llm-router.js.map