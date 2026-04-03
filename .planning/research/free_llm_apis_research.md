# Free LLM APIs for AI Agent Development (2025-2026)

**Researched:** 2026-04-03
**Purpose:** Identify best free LLM APIs for building a BusinessHub AI agent with text generation, vision (invoice reading), function calling, and structured JSON output.
**Overall Confidence:** MEDIUM-HIGH (verified across multiple sources; exact limits change frequently)

---

## Executive Summary

Google Gemini is the clear winner for a free-tier AI agent. It offers the most complete feature set (vision, function calling, structured output, 1M context) with generous limits. Groq is the best secondary provider for speed-critical text tasks. The recommended strategy is a **Gemini-primary with Groq/Cerebras fallback chain**.

Mistral's free Experiment tier is surprisingly generous (1B tokens/month) but limited to 1-2 RPM, making it a good background/batch processor. SambaNova and Cerebras offer fast inference with persistent free tiers. OpenRouter acts as a meta-fallback aggregating multiple free models.

---

## Provider Comparison Matrix

| Provider | Free Tier Type | Best For | Vision | Function Calling | JSON Mode | Context Window |
|----------|---------------|----------|--------|-----------------|-----------|----------------|
| **Google Gemini** | Persistent, no CC | Primary agent | YES | YES | YES | 1M tokens |
| **Groq** | Persistent, no CC | Fast text fallback | YES (Scout) | YES | YES | 128K |
| **Cerebras** | Persistent, no CC | Speed + tool calling | NO | YES | YES | 128K |
| **Mistral** | Persistent, no CC | Batch processing | YES (Pixtral) | YES | YES | 128K |
| **SambaNova** | Persistent + $5 credit | Large model access | YES (Llama 3.2) | Limited | YES | 128K |
| **OpenRouter** | Persistent, no CC | Meta-fallback | Varies | Varies | Varies | Varies |
| **GitHub Models** | Persistent, no CC | GPT-4o access | YES | YES | YES | 8K input cap |
| **Cloudflare Workers AI** | Persistent, no CC | Edge deployment | YES (Llama 3.2 11B) | NO | NO | 4K-8K |
| **Cohere** | Persistent, no CC | RAG/embeddings | NO | YES | YES | 128K |
| **HuggingFace** | Persistent, no CC | Niche models | Limited | NO | NO | Varies |
| **Together AI** | $25 credit (expiring) | Wide model catalog | YES | YES | YES | Varies |

---

## Detailed Provider Analysis

### 1. Google Gemini API (RECOMMENDED PRIMARY)

**Signup:** https://aistudio.google.com/
**SDK:** `@google/genai` (npm) -- NOTE: `@google/generative-ai` is DEPRECATED as of Nov 2025
**Confidence:** HIGH

#### Free Tier Models & Limits

| Model | RPM | RPD | TPM | Context | Vision | Function Calling | JSON Mode |
|-------|-----|-----|-----|---------|--------|-----------------|-----------|
| gemini-2.5-pro | 5 | 100 | 250,000 | 1M | YES | YES | YES |
| gemini-2.5-flash | 10 | 250 | 250,000 | 1M | YES | YES | YES |
| gemini-2.5-flash-lite | 15 | 1,000 | 250,000 | 1M | YES | YES | YES |
| gemini-2.0-flash | 10 | 250 | 250,000 | 1M | YES | YES | YES |

**Key Features:**
- Native multimodal: images (PNG, JPEG, WEBP, HEIC), video, audio, PDF
- Structured output via `response_mime_type: "application/json"` + JSON schema
- Function calling with automatic or manual tool execution
- 1M token context window (largest free offering)
- Image generation with gemini-2.5-flash-image

**Limitations:**
- Actual capacity often lower than stated limits during peak hours (reports of 20 RPD effective on 2.5 Flash)
- Free tier data may be used for training
- December 2025 quota cuts hit 2.5 Pro hardest

**Rate Limit Headers:**
```
x-ratelimit-limit-requests
x-ratelimit-remaining-requests
x-ratelimit-reset-requests
retry-after (seconds)
```

**Why Primary:** Only provider offering vision + function calling + structured output + 1M context on free tier. Best-in-class multimodal capabilities for invoice reading.

---

### 2. Groq API (RECOMMENDED FAST FALLBACK)

**Signup:** https://console.groq.com/
**SDK:** `groq-sdk` (npm) -- OpenAI-compatible API
**Confidence:** HIGH

#### Free Tier Models & Limits

| Model | RPM | RPD | TPM | TPD | Context | Vision | Function Calling |
|-------|-----|-----|-----|-----|---------|--------|-----------------|
| llama-3.1-8b-instant | 30 | 14,400 | 6,000 | 500,000 | 128K | NO | YES |
| llama-3.3-70b-versatile | 30 | 1,000 | 12,000 | 100,000 | 128K | NO | YES |
| llama-4-scout-17b | 30 | 1,000 | 30,000 | 500,000 | 128K | YES | YES |
| qwen3-32b | 60 | 1,000 | 6,000 | 500,000 | 128K | NO | YES |
| kimi-k2-instruct | 60 | 1,000 | 10,000 | 300,000 | 128K | NO | YES |
| gpt-oss-120b | 30 | 1,000 | 8,000 | 200,000 | 128K | NO | YES |

**Key Features:**
- Extreme inference speed: 300-2600 tokens/sec (custom LPU hardware)
- OpenAI-compatible API (drop-in replacement)
- Tool use / function calling on all chat models
- JSON mode supported
- Cached tokens don't count toward limits

**Vision Models:**
- `llama-4-scout-17b-16e-instruct` -- multimodal (text + images), 12 languages
- `llama-4-maverick-17b-128e-instruct` -- larger multimodal model

**Limitations:**
- Vision limited to Llama 4 models
- 70B models only 1,000 RPD
- No audio/video processing

**Rate Limit Headers:**
```
x-ratelimit-limit-requests
x-ratelimit-remaining-requests
x-ratelimit-limit-tokens
x-ratelimit-remaining-tokens
retry-after
```

**Why Fast Fallback:** Fastest inference speed of any free provider. 14,400 RPD on 8B model is excellent for simple text tasks. OpenAI-compatible API makes integration trivial.

---

### 3. Cerebras (RECOMMENDED SPEED + TOOLS FALLBACK)

**Signup:** https://cloud.cerebras.ai/
**SDK:** `@cerebras/cerebras_cloud_sdk` (npm) -- OpenAI-compatible
**Confidence:** MEDIUM-HIGH

#### Free Tier Limits

| Model | RPM | TPD | Context | Function Calling | JSON Mode |
|-------|-----|-----|---------|-----------------|-----------|
| llama-3.3-70b | 30 | 1M | 128K | YES | YES |
| qwen3-32b | 30 | 1M | 128K | YES | YES |
| qwen3-235b-a22b | 30 | 1M | 128K | YES | YES |
| gpt-oss-120b | 30 | 1M | 128K | YES | YES |
| glm-4.6 | 30 | 1M | 128K | YES | YES |

**Key Features:**
- 1M tokens/day free (some sources say up to 24M tokens/day)
- Wafer-scale engine: 450-2600 tokens/sec
- ALL models support: streaming, structured outputs, tool calling, multi-turn tool calling
- GLM-4.6 ranked #1 for tool calling on Berkeley Function Calling Leaderboard

**Limitations:**
- NO vision models on free tier
- No audio/multimodal
- Speed advantage matters most for sequential agentic workflows

**Why Speed + Tools:** Best tool calling quality (GLM-4.6). Generous 1M tokens/day. Extremely fast inference ideal for agent loops.

---

### 4. Mistral AI (BATCH/BACKGROUND PROCESSOR)

**Signup:** https://console.mistral.ai/
**SDK:** `@mistralai/mistralai` (npm)
**Confidence:** MEDIUM

#### Free Experiment Tier

| Model | RPM | Tokens/Month | Context | Vision | Function Calling |
|-------|-----|-------------|---------|--------|-----------------|
| mistral-small-latest | ~1-2 | 1B shared | 128K | NO | YES |
| mistral-medium-latest | ~1-2 | 1B shared | 128K | NO | YES |
| mistral-large-latest | ~1-2 | 1B shared | 128K | NO | YES |
| pixtral-12b-2409 | ~1-2 | 1B shared | 128K | YES | YES |
| codestral-latest | ~1-2 | 1B shared | 128K | NO | YES |

**Key Features:**
- 1 BILLION tokens/month free (most generous monthly allowance)
- Access to ALL models including Large and Pixtral
- Pixtral 12B supports vision + function calling together
- Structured JSON output supported
- Function calling with external tool integration

**Limitations:**
- Very low RPM (~1-2 requests per second)
- Free tier data may be used for training
- Not suitable for real-time/interactive use
- Rate limits make it impractical as primary agent

**Why Batch:** 1B tokens/month is enormous. Use for overnight batch processing, report generation, or as a last-resort fallback when all other providers are rate-limited.

---

### 5. SambaNova

**Signup:** https://cloud.sambanova.ai/
**SDK:** OpenAI-compatible API (use `openai` npm package with custom base URL)
**Confidence:** MEDIUM

#### Free Tier Limits

| Model | RPM | Context | Vision |
|-------|-----|---------|--------|
| Meta-Llama-3.1-8B | 30 | 128K | NO |
| Meta-Llama-3.1-70B | 20 | 128K | NO |
| Meta-Llama-3.1-405B | 10 | 128K | NO |
| Meta-Llama-3.2-11B-Vision | 10 | 128K | YES |
| Meta-Llama-3.2-90B-Vision | 1 | 128K | YES |
| Meta-Llama-3.3-70B | 20 | 128K | NO |
| Qwen2.5-72B | 20 | 128K | NO |
| QwQ-32B | 10 | 128K | NO |

**Key Features:**
- Persistent free tier (never expires) + $5 initial credits
- Access to massive 405B parameter model for free
- Vision support via Llama 3.2 Vision models
- Custom RDU hardware for fast inference

**Limitations:**
- Llama 3.2 90B Vision limited to 1 RPM
- Function calling support is limited/experimental
- No structured output guarantees

---

### 6. OpenRouter (META-FALLBACK AGGREGATOR)

**Signup:** https://openrouter.ai/
**SDK:** OpenAI-compatible API (use `openai` npm package with custom base URL)
**Confidence:** MEDIUM

#### Free Tier

- **Without credits:** 20 RPM, 50 RPD
- **With $10+ credits purchased:** 20 RPM, 1,000 RPD
- **Free router endpoint:** `openrouter/free` (auto-selects from free model pool)

**Available Free Models (29+ as of April 2026):**
- DeepSeek R1/V3 (free variants)
- Llama 4 Scout
- Qwen3 235B
- Various community-hosted models

**Key Features:**
- Single API endpoint, multiple providers
- `openrouter/free` router auto-picks best available free model
- Failed attempts count toward quota
- Model quality varies per request with free router

**Limitations:**
- Free models can be removed without notice
- Random model selection with free router = inconsistent quality
- Vision/function calling depends on which model is selected
- 50 RPD without spending is very limiting

**Why Meta-Fallback:** When all primary providers are rate-limited, OpenRouter can route to whatever free model is available. Buy $10 credits once to unlock 1,000 RPD.

---

### 7. GitHub Models

**Signup:** https://github.com/marketplace/models (requires GitHub account)
**SDK:** OpenAI-compatible API or `@azure-rest/ai-inference` (npm)
**Confidence:** MEDIUM

#### Free Tier Limits

| Model Tier | RPM | RPD | Input Tokens/Req | Output Tokens/Req |
|-----------|-----|-----|-------------------|-------------------|
| High (GPT-4o, GPT-4.1) | 10 | 50 | 8,000 | 4,000 |
| Low (smaller models) | 15 | 150 | 8,000 | 4,000 |
| Embedding | 15 | 150 | 8,000 | N/A |

**Key Features:**
- Access to GPT-4o, GPT-4.1, o3, Grok-3, DeepSeek-R1 for FREE
- Vision, function calling, structured output (GPT-4o/4.1)
- Playground for testing

**Limitations:**
- Very low RPD (50 for best models)
- Hard cap of 8K input tokens per request (kills invoice analysis with images)
- 4K output token cap per request
- Not suitable as primary provider

**Why Useful:** Free GPT-4o access for quality-critical tasks, but severe per-request token limits.

---

### 8. Cloudflare Workers AI

**Signup:** https://dash.cloudflare.com/ (free Cloudflare account)
**SDK:** `@cloudflare/ai` (within Workers) or REST API
**Confidence:** LOW-MEDIUM

#### Free Tier

- 10,000 neurons/day (transitioning to token-based pricing)
- Models: Llama 3.2 (1B, 3B, 11B Vision), Mistral 7B, FLUX.2

**Key Features:**
- Edge deployment (low latency worldwide)
- Serverless (no infrastructure management)
- Llama 3.2 11B Vision for image understanding

**Limitations:**
- Small context windows (4K-8K)
- No function calling support
- No structured JSON output enforcement
- Neuron-based pricing is confusing
- Limited model selection

**Verdict:** Not suitable for an AI agent. Good for simple edge inference only.

---

### 9. Cohere

**Signup:** https://dashboard.cohere.com/
**SDK:** `cohere-ai` (npm)
**Confidence:** MEDIUM

#### Free Trial Tier

- 1,000 API calls/month, 100 RPM
- Models: Command R+, Command A, Embed 4, Rerank 3.5
- Function calling: YES (tool use)
- Structured output: YES
- Vision: NO

**Limitations:**
- Non-commercial use restriction on trial keys
- 1,000 calls/month is very limiting
- No vision capabilities

**Verdict:** Useful for RAG/embeddings only. Not suitable as primary agent provider.

---

### 10. Hugging Face Inference API

**Signup:** https://huggingface.co/
**SDK:** `@huggingface/inference` (npm)
**Confidence:** LOW

#### Free Tier

- 100,000 characters generated/month
- 60 RPM
- 300+ models but mostly small (<10B on free tier)
- Cold starts on unpopular models

**Limitations:**
- Character-based limits (not token-based)
- Mostly CPU inference for free tier
- No reliable function calling
- Limited vision model access
- Cold start latency

**Verdict:** Too limited for agent use. Better for embeddings or classification tasks.

---

### 11. Together AI

**Signup:** https://api.together.xyz/
**SDK:** OpenAI-compatible API (use `openai` npm package with custom base URL)
**Confidence:** MEDIUM

#### Free Tier

- $25 signup credits (expiring)
- 200+ models available
- Dynamic rate limits (rolling out Jan 2026+)

**Key Features:**
- Huge model catalog (200+)
- Text, image, video, code, audio models
- Function calling and JSON mode on supported models

**Limitations:**
- Credits expire (not a persistent free tier)
- After credits run out, pay-per-token only
- Dynamic rate limits are unpredictable

**Verdict:** Good for initial prototyping with $25 credit. Not a long-term free solution.

---

## Rankings

### Best Free Tier Overall

1. **Google Gemini** -- Most complete feature set, 1M context, generous limits
2. **Groq** -- Fastest inference, good limits on small models (14.4K RPD)
3. **Cerebras** -- 1M tokens/day, excellent tool calling, fast inference
4. **Mistral** -- 1B tokens/month, access to all models (but slow RPM)
5. **SambaNova** -- Access to 405B model, persistent free tier

### Best for Vision (Invoice Reading)

1. **Google Gemini** -- Native multimodal on ALL models, best image understanding
2. **Groq** (Llama 4 Scout) -- Fast vision inference, 1,000 RPD
3. **Mistral** (Pixtral 12B) -- Vision + function calling, but ~1 RPM
4. **SambaNova** (Llama 3.2 Vision) -- 90B vision at 1 RPM, 11B at 10 RPM
5. **GitHub Models** (GPT-4o) -- Excellent vision but 8K input token cap

### Best for Function Calling

1. **Cerebras** (GLM-4.6) -- #1 on Berkeley Function Calling Leaderboard
2. **Google Gemini** -- Native function calling, well-documented
3. **Groq** -- Fast execution, Llama-3-Groq tool use models
4. **Mistral** -- All models support tool use
5. **GitHub Models** (GPT-4o/4.1) -- Excellent but low RPD

### Best for Structured JSON Output

1. **Google Gemini** -- Schema enforcement via response_mime_type
2. **Cerebras** -- json_schema response_format on all models
3. **Groq** -- JSON mode supported
4. **Mistral** -- JSON output mode

---

## Recommended Fallback Chain Strategy

### Architecture

```
Primary: Google Gemini 2.5 Flash
    |
    v (rate limited?)
Fallback 1: Groq (llama-4-scout for vision, llama-3.3-70b for text)
    |
    v (rate limited?)
Fallback 2: Cerebras (best tool calling, no vision)
    |
    v (rate limited?)
Fallback 3: Mistral (slow but huge monthly quota)
    |
    v (rate limited?)
Fallback 4: OpenRouter /free (last resort)
```

### For Vision Tasks (Invoice Reading)

```
Primary: Google Gemini 2.5 Flash (vision)
    |
    v (rate limited?)
Fallback 1: Groq llama-4-scout (vision)
    |
    v (rate limited?)
Fallback 2: SambaNova Llama 3.2 11B Vision
    |
    v (rate limited?)
Fallback 3: Queue for retry (no more free vision providers with good limits)
```

### TypeScript Implementation Pattern

```typescript
// ============================================================
// LLM Provider Fallback Chain
// ============================================================

import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

// -- Types --

interface LLMProvider {
  name: string;
  priority: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJSON: boolean;
  /** Calls the LLM. Throws RateLimitError if 429. */
  chat(params: ChatParams): Promise<ChatResponse>;
  /** Check if provider is currently rate-limited (via local tracking). */
  isAvailable(): boolean;
  /** Record a rate limit hit -- sets a cooldown timer. */
  markRateLimited(retryAfterMs: number): void;
}

interface ChatParams {
  messages: Array<{ role: string; content: string | ContentPart[] }>;
  tools?: ToolDefinition[];
  responseFormat?: 'json' | 'text';
  /** Base64-encoded images for vision tasks */
  images?: Array<{ mimeType: string; data: string }>;
}

interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  provider: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string };

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(provider: string, retryAfterMs: number) {
    super(`${provider} rate limited. Retry after ${retryAfterMs}ms`);
    this.retryAfterMs = retryAfterMs;
  }
}

// -- Provider Implementations --

class GeminiProvider implements LLMProvider {
  name = 'gemini';
  priority = 1;
  supportsVision = true;
  supportsFunctionCalling = true;
  supportsJSON = true;

  private client: GoogleGenAI;
  private rateLimitedUntil = 0;
  private model = 'gemini-2.5-flash';

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  isAvailable(): boolean {
    return Date.now() > this.rateLimitedUntil;
  }

  markRateLimited(retryAfterMs: number): void {
    this.rateLimitedUntil = Date.now() + retryAfterMs;
    console.warn(
      `[${this.name}] Rate limited until ${new Date(this.rateLimitedUntil).toISOString()}`
    );
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    try {
      const contents = this.buildContents(params);
      const config: Record<string, unknown> = {};

      if (params.responseFormat === 'json') {
        config.responseMimeType = 'application/json';
      }
      if (params.tools?.length) {
        config.tools = [{
          functionDeclarations: params.tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        }];
      }

      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config,
      });

      return {
        content: response.text ?? '',
        toolCalls: this.extractToolCalls(response),
        provider: this.name,
        model: this.model,
      };
    } catch (error: any) {
      if (error?.status === 429 || error?.code === 429) {
        const retryAfter = this.parseRetryAfter(error);
        this.markRateLimited(retryAfter);
        throw new RateLimitError(this.name, retryAfter);
      }
      throw error;
    }
  }

  private buildContents(params: ChatParams): any[] {
    return params.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map(p =>
            p.type === 'text'
              ? { text: p.text }
              : { inlineData: { mimeType: p.mimeType, data: p.data } }
          ),
    }));
  }

  private extractToolCalls(response: any): ToolCall[] | undefined {
    const calls = response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.functionCall)
      ?.map((p: any) => ({
        name: p.functionCall.name,
        arguments: p.functionCall.args,
      }));
    return calls?.length ? calls : undefined;
  }

  private parseRetryAfter(error: any): number {
    const retryAfter = error?.headers?.['retry-after'];
    return retryAfter ? parseInt(retryAfter) * 1000 : 60_000;
  }
}

class GroqProvider implements LLMProvider {
  name = 'groq';
  priority = 2;
  supportsVision = true;
  supportsFunctionCalling = true;
  supportsJSON = true;

  private client: Groq;
  private rateLimitedUntil = 0;
  private textModel = 'llama-3.3-70b-versatile';
  private visionModel = 'meta-llama/llama-4-scout-17b-16e-instruct';

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  isAvailable(): boolean {
    return Date.now() > this.rateLimitedUntil;
  }

  markRateLimited(retryAfterMs: number): void {
    this.rateLimitedUntil = Date.now() + retryAfterMs;
    console.warn(
      `[${this.name}] Rate limited until ${new Date(this.rateLimitedUntil).toISOString()}`
    );
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const hasImages = params.images?.length || params.messages.some(
      m => Array.isArray(m.content) && m.content.some(p => p.type === 'image')
    );
    const model = hasImages ? this.visionModel : this.textModel;

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: params.messages as any,
        tools: params.tools?.map(t => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        response_format: params.responseFormat === 'json'
          ? { type: 'json_object' }
          : undefined,
      });

      const choice = completion.choices[0];
      return {
        content: choice.message.content ?? '',
        toolCalls: choice.message.tool_calls?.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
        provider: this.name,
        model,
        usage: completion.usage ? {
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
        } : undefined,
      };
    } catch (error: any) {
      if (error?.status === 429) {
        const retryAfter = parseInt(
          error?.headers?.['retry-after'] ?? '60'
        ) * 1000;
        this.markRateLimited(retryAfter);
        throw new RateLimitError(this.name, retryAfter);
      }
      throw error;
    }
  }
}

// -- OpenAI-Compatible Providers (Cerebras, Mistral, SambaNova, OpenRouter) --
//
// Use the `openai` npm package with custom baseURL:
//
//   import OpenAI from 'openai';
//
//   const cerebras = new OpenAI({
//     apiKey: process.env.CEREBRAS_API_KEY,
//     baseURL: 'https://api.cerebras.ai/v1',
//   });
//
//   const sambanova = new OpenAI({
//     apiKey: process.env.SAMBANOVA_API_KEY,
//     baseURL: 'https://api.sambanova.ai/v1',
//   });
//
//   const mistral = new OpenAI({
//     apiKey: process.env.MISTRAL_API_KEY,
//     baseURL: 'https://api.mistral.ai/v1',
//   });
//
//   const openrouter = new OpenAI({
//     apiKey: process.env.OPENROUTER_API_KEY,
//     baseURL: 'https://openrouter.ai/api/v1',
//   });

// -- Fallback Chain Router --

class LLMRouter {
  private providers: LLMProvider[];

  constructor(providers: LLMProvider[]) {
    this.providers = providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Send a chat request through the fallback chain.
   * Automatically skips rate-limited providers and falls through.
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    const needsVision = !!params.images?.length || params.messages.some(
      m => Array.isArray(m.content) && m.content.some(p => p.type === 'image')
    );
    const needsFunctionCalling = !!params.tools?.length;
    const needsJSON = params.responseFormat === 'json';

    // Filter to capable + available providers
    const eligible = this.providers.filter(p => {
      if (!p.isAvailable()) return false;
      if (needsVision && !p.supportsVision) return false;
      if (needsFunctionCalling && !p.supportsFunctionCalling) return false;
      if (needsJSON && !p.supportsJSON) return false;
      return true;
    });

    if (eligible.length === 0) {
      throw new Error(
        `All LLM providers rate-limited or incapable. ` +
        `Needs: vision=${needsVision}, tools=${needsFunctionCalling}, json=${needsJSON}`
      );
    }

    // Try each provider in priority order
    let lastError: Error | null = null;
    for (const provider of eligible) {
      try {
        console.log(`[LLMRouter] Trying ${provider.name}...`);
        const response = await provider.chat(params);
        console.log(
          `[LLMRouter] Success via ${provider.name} (${response.model})`
        );
        return response;
      } catch (error) {
        if (error instanceof RateLimitError) {
          console.warn(
            `[LLMRouter] ${provider.name} rate limited, trying next...`
          );
          lastError = error;
          continue;
        }
        throw error; // Non-rate-limit errors bubble up
      }
    }

    throw lastError ?? new Error('All providers failed');
  }

  /** Get status of all providers */
  getStatus(): Array<{
    name: string;
    available: boolean;
    features: string[];
  }> {
    return this.providers.map(p => ({
      name: p.name,
      available: p.isAvailable(),
      features: [
        p.supportsVision ? 'vision' : '',
        p.supportsFunctionCalling ? 'tools' : '',
        p.supportsJSON ? 'json' : '',
      ].filter(Boolean),
    }));
  }
}

// -- Usage Example --

const router = new LLMRouter([
  new GeminiProvider(process.env.GEMINI_API_KEY!),
  new GroqProvider(process.env.GROQ_API_KEY!),
  // Add CerebrasProvider, MistralProvider with priority 3, 4...
]);

// Text generation with function calling
const textResult = await router.chat({
  messages: [{ role: 'user', content: 'Analyze last month revenue trends' }],
  tools: [{
    name: 'getRevenue',
    description: 'Get revenue data for a date range',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
      },
      required: ['startDate', 'endDate'],
    },
  }],
  responseFormat: 'json',
});

// Vision: read invoice photo
const visionResult = await router.chat({
  messages: [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'Extract line items, amounts, tax, and total from this invoice as JSON.',
      },
      { type: 'image', mimeType: 'image/jpeg', data: invoiceBase64 },
    ],
  }],
  responseFormat: 'json',
});
```

---

## SDK Installation Summary

```bash
# Primary: Google Gemini
npm install @google/genai

# Fallback 1: Groq
npm install groq-sdk

# Fallback 2+: OpenAI-compatible providers (Cerebras, SambaNova, Mistral, OpenRouter)
npm install openai

# Optional: Vercel AI SDK (unified interface for multiple providers)
npm install ai @ai-sdk/google @ai-sdk/openai
```

### Provider Base URLs for OpenAI SDK

| Provider | Base URL | Env Variable |
|----------|----------|--------------|
| Cerebras | `https://api.cerebras.ai/v1` | `CEREBRAS_API_KEY` |
| SambaNova | `https://api.sambanova.ai/v1` | `SAMBANOVA_API_KEY` |
| Mistral | `https://api.mistral.ai/v1` | `MISTRAL_API_KEY` |
| OpenRouter | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` |
| GitHub Models | `https://models.inference.ai.azure.com` | `GITHUB_TOKEN` |
| Together AI | `https://api.together.xyz/v1` | `TOGETHER_API_KEY` |

---

## Signup URLs (All Free, No Credit Card)

| Provider | URL | CC Required |
|----------|-----|-------------|
| Google Gemini | https://aistudio.google.com/ | NO |
| Groq | https://console.groq.com/ | NO |
| Cerebras | https://cloud.cerebras.ai/ | NO |
| Mistral | https://console.mistral.ai/ | NO |
| SambaNova | https://cloud.sambanova.ai/ | NO |
| OpenRouter | https://openrouter.ai/ | NO ($10 recommended) |
| GitHub Models | https://github.com/marketplace/models | NO (GitHub acct) |
| Cloudflare | https://dash.cloudflare.com/ | NO |
| Cohere | https://dashboard.cohere.com/ | NO |
| HuggingFace | https://huggingface.co/ | NO |
| Together AI | https://api.together.xyz/ | NO ($25 credit) |

---

## Recommendation for BusinessHub AI Agent

### Immediate Setup (Phase 1)

1. **Sign up for 3 providers:** Google Gemini, Groq, Cerebras
2. **Store 3 API keys** in environment variables
3. **Implement the LLMRouter** pattern above
4. **Use Gemini for all tasks** -- it covers vision, tools, and JSON
5. **Groq as fallback** for text tasks (blazing fast)
6. **Cerebras as fallback** for function calling tasks

### Key Architecture Decisions

- **Use `@google/genai` for Gemini** (NOT the deprecated `@google/generative-ai`)
- **Use `openai` npm package** for all OpenAI-compatible providers (Groq also has native SDK)
- **Implement rate limit tracking locally** -- don't rely solely on 429 responses
- **Track daily usage counters** -- RPD limits are the real bottleneck on free tiers
- **Queue vision tasks** -- only Gemini has reliable free-tier vision for invoice processing

### Cost: $0/month

All three recommended providers are truly free with no credit card required and no expiration.

---

## Sources

- [Google Gemini Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Google Gemini Function Calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Google GenAI JS SDK](https://www.npmjs.com/package/@google/genai)
- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)
- [Groq Vision Docs](https://console.groq.com/docs/vision)
- [Groq Tool Use](https://console.groq.com/docs/tool-use)
- [Groq SDK npm](https://www.npmjs.com/package/groq-sdk)
- [Cerebras Rate Limits](https://inference-docs.cerebras.ai/support/rate-limits)
- [Cerebras Tool Calling](https://inference-docs.cerebras.ai/capabilities/tool-use)
- [Cerebras Free Tier Analysis](https://adam.holter.com/cerebras-opens-a-free-1m-tokens-per-day-inference-tier-and-ccerebras-now-offers-free-inference-with-1m-tokens-per-day-real-speed-benchmarks-show-2600-tokens-sec-on-llama4scout-here-are-the-actual-n/)
- [SambaNova Rate Limits](https://docs.sambanova.ai/docs/en/models/rate-limits)
- [Mistral Rate Limits & Tiers](https://docs.mistral.ai/deployment/ai-studio/tier)
- [OpenRouter Free Models](https://openrouter.ai/collections/free-models)
- [GitHub Models Billing](https://docs.github.com/billing/managing-billing-for-your-products/about-billing-for-github-models)
- [Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cohere Rate Limits](https://docs.cohere.com/docs/rate-limits)
- [HuggingFace Inference Pricing](https://huggingface.co/docs/inference-providers/pricing)
- [Every Free AI API in 2026 (Awesome Agents)](https://awesomeagents.ai/tools/free-ai-inference-providers-2026/)
- [Groq Free Tier Limits 2026](https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb)
- [Gemini Free Tier Changes](https://www.howtogeek.com/gemini-slashed-free-api-limits-what-to-use-instead/)
- [OpenRouter Free Models List (Apr 2026)](https://costgoat.com/pricing/openrouter-free-models)
