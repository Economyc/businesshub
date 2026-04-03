# Technology Stack

**Project:** BusinessHub AI Agent
**Researched:** 2026-04-03

## Recommended Stack

### LLM Providers (Free Tier)

| Provider | Model | RPM | RPD | Context | Function Calling | Vision | Why |
|----------|-------|-----|-----|---------|-----------------|--------|-----|
| Google AI Studio | Gemini 2.5 Flash | 10 | 250 | 1M tokens | YES | YES | Best free tier: vision + function calling + huge context |
| Google AI Studio | Gemini 2.5 Flash-Lite | 15 | 1,000 | 1M tokens | YES | Limited | High-volume fallback for simple tasks |
| Groq | Llama 3.3 70B | ~30 | 1,000+ | 128K | YES | NO | Ultra-fast inference (300+ tok/s), text-only fallback |
| OpenRouter | Free router | 20 | 200 | Varies | Some models | Some models | Meta-fallback, auto-selects capable free model |
| Together AI | Llama 4 Maverick | Varies | Varies | 128K | YES | YES | Vision fallback with $5 free credits |

### Primary: Google Gemini 2.5 Flash
**Why:** Only free API that combines ALL three requirements: generous rate limits, native function calling, AND vision/multimodal support. 1M token context window is unmatched.

### Agent Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel AI SDK | v6+ | Agent orchestration, streaming UI, tool calling | 20M+ monthly downloads, provider-agnostic, works with React + any backend |
| @ai-sdk/react | latest | React hooks (useChat, useCompletion) | Type-safe streaming chat with tool invocation support |
| @ai-sdk/google | latest | Gemini provider | First-class Gemini integration |
| @ai-sdk/groq | latest | Groq provider | Fallback provider |
| @ai-sdk/openrouter | latest | OpenRouter provider | Meta-fallback provider |

### Backend (LLM Proxy)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Firebase Cloud Functions | v2 (2nd gen) | LLM API proxy, tool execution | Already in stack (Firebase), no new infra needed |
| firebase-functions | latest | Cloud Functions SDK | Handles HTTP triggers for agent endpoint |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | latest | Tool parameter schemas | Define type-safe tool inputs for function calling |
| ai | latest (v6) | Core AI SDK | Agent loop, streaming, tool management |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Agent Framework | Vercel AI SDK | LangChain.js | LangChain is heavier, more abstractions than needed, slower iteration. AI SDK is lighter and TypeScript-native |
| Agent Framework | Vercel AI SDK | Mastra | Newer (less battle-tested), adds unnecessary server layer. AI SDK is more mature |
| Agent Framework | Vercel AI SDK | Build from scratch | Reinventing streaming, tool loops, provider switching. AI SDK handles all of this |
| Primary LLM | Gemini 2.5 Flash | Groq Llama 3.3 | Groq lacks vision -- critical for invoice OCR |
| Primary LLM | Gemini 2.5 Flash | OpenRouter free | Lower rate limits (200/day vs 250/day), less predictable model selection |
| Backend | Firebase Cloud Functions | Cloudflare Workers | Already using Firebase; adding Cloudflare adds complexity |
| Backend | Firebase Cloud Functions | Express server | Would need separate hosting; Firebase Functions are serverless and free tier |

## Installation

```bash
# Core AI SDK
npm install ai @ai-sdk/react @ai-sdk/google @ai-sdk/groq zod

# Firebase Functions (in functions/ directory)
cd functions && npm install ai @ai-sdk/google @ai-sdk/groq
```

## Provider Configuration

```typescript
// Firebase Cloud Function - agent endpoint
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Primary model
const primaryModel = google('gemini-2.5-flash');
// Fallback model
const fallbackModel = groq('llama-3.3-70b-versatile');
```

## API Key Management

All keys stored in Firebase environment config (NOT in client code):
```bash
firebase functions:config:set \
  ai.google_key="YOUR_GEMINI_KEY" \
  ai.groq_key="YOUR_GROQ_KEY"
```

## Sources

- https://ai-sdk.dev/docs/introduction
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://console.groq.com/docs/rate-limits
- https://openrouter.ai/collections/free-models
- https://github.com/cheahjs/free-llm-api-resources
- https://vercel.com/blog/ai-sdk-6
