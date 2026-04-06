# Ollama Cloud Research

**Researched:** 2026-04-03
**Confidence:** MEDIUM (official docs confirmed existence; pricing page was unreachable for exact limits)

---

## 1. Does Ollama Cloud exist?

**YES.** Ollama Cloud launched in preview around September 2025. It is a hosted GPU inference service integrated directly into the Ollama ecosystem (app, CLI, and API).

- URL: **https://ollama.com**
- Cloud models page: https://ollama.com/search?c=cloud
- Docs: https://docs.ollama.com/cloud

## 2. Pricing

| Plan | Price | Notes |
|------|-------|-------|
| Free | $0 | Included with account, limited session/weekly usage |
| Pro | $20/month | Higher limits |
| Max | $100/month | Highest limits |

**Billing model:** Fixed subscription (NOT per-token). Limits are based on GPU time, which varies by model size and request duration. Session limits reset every **5 hours**, weekly limits reset every **7 days**.

Usage-based (metered) pricing was announced as "coming soon" but not yet confirmed live.

## 3. Available Cloud Models

Cloud models use the `:cloud` suffix. Examples found:
- `qwen3.5:cloud`
- `glm-5:cloud`
- `gpt-oss:120b-cloud`

Full catalog at: https://ollama.com/search?c=cloud

These are large models (70B-120B+) that would be impractical to run locally for most users.

## 4. API Access

### Native Ollama API
- Endpoint: `https://ollama.com/api/chat`
- Auth: API key created at https://ollama.com/settings/keys
- Set via: `export OLLAMA_API_KEY=your_key`

### OpenAI-Compatible Endpoint

**Not confirmed for cloud.** The OpenAI-compatible endpoint (`/v1/chat/completions`) is well-documented for **local** Ollama at `http://localhost:11434/v1/`. The official cloud docs do NOT mention `https://ollama.com/v1/chat/completions` as a supported endpoint.

**Likely workaround:** Since Ollama Cloud acts as a "remote Ollama host," it is plausible that `https://ollama.com/v1/chat/completions` works with an API key, but this is **unverified** (LOW confidence). You would need to test it.

## 5. Key Takeaways

- Ollama Cloud is real and usable today, not vaporware.
- It is subscription-based, not pay-per-token -- unusual compared to OpenAI/Anthropic.
- The native API is at `ollama.com/api/chat`, not an OpenAI-compatible format.
- OpenAI compatibility on the cloud endpoint is undocumented -- may or may not work.
- Data is not logged or trained on. Infrastructure is primarily US-based (also EU, Singapore).
- No formal SLA mentioned -- this is still a preview/consumer-grade service.

## Sources

- [Ollama Cloud Docs](https://docs.ollama.com/cloud)
- [Ollama Pricing](https://ollama.com/pricing)
- [Ollama Cloud Page](https://ollama.com/cloud)
- [OpenAI Compatibility Docs](https://docs.ollama.com/api/openai-compatibility)
- [DeepWiki: Cloud Models](https://deepwiki.com/ollama/ollama/4.7-cloud-models)
