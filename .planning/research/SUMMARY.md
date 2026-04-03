# Research Summary: AI Agent for BusinessHub

**Domain:** AI-powered assistant embedded in a business management web application
**Researched:** 2026-04-03
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

Building an AI agent into BusinessHub is highly feasible with today's free-tier LLM landscape. The ecosystem has matured significantly through 2025-2026, with multiple providers offering generous free tiers that include function calling (essential for agent-app interaction) and vision capabilities (essential for invoice OCR). The key architectural decision is using a lightweight backend proxy (Firebase Cloud Functions) to handle LLM API calls securely, paired with the Vercel AI SDK on the frontend for streaming chat UI and tool orchestration.

Google Gemini 2.5 Flash is the recommended primary LLM due to its generous free tier (10 RPM, 250 requests/day, 1M context window), native function calling, and vision/multimodal support. Groq serves as the speed-optimized fallback for text-only tasks (300+ tokens/sec on Llama models). OpenRouter provides a meta-fallback layer with 29+ free models. This three-tier fallback chain ensures the agent remains functional even when individual providers hit rate limits.

The Vercel AI SDK (v5/v6) is the recommended agent framework. Despite BusinessHub being a Vite + React project (not Next.js), the SDK's `useChat` hook works with any backend endpoint via SSE streaming. Combined with Firebase Cloud Functions as the backend, this provides a production-ready agent architecture without migrating away from Vite.

The most critical pitfall is exposing API keys client-side. All LLM calls MUST go through a backend proxy. The second biggest risk is over-engineering the agent -- start with a simple ReAct loop with 3-5 tools, not a complex multi-agent system.

## Key Findings

**Stack:** Vercel AI SDK v6 (frontend) + Firebase Cloud Functions (backend proxy) + Gemini 2.5 Flash (primary LLM) + Groq/OpenRouter (fallbacks)
**Architecture:** Backend proxy pattern with SSE streaming, ReAct agent loop with function calling, provider fallback chain
**Critical pitfall:** Never expose LLM API keys client-side; always proxy through Firebase Cloud Functions

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation: Backend Proxy + Basic Chat** - Set up Firebase Cloud Function as LLM proxy, implement basic streaming chat UI with Vercel AI SDK `useChat`, connect to Gemini API
   - Addresses: Core infrastructure, streaming UI
   - Avoids: Client-side API key exposure

2. **Tool System: Function Calling** - Define 3-5 core tools (query financials, search employees, create records), implement ReAct loop with tool execution
   - Addresses: Agent-app interaction, real utility
   - Avoids: Over-engineering with too many tools upfront

3. **Vision: Invoice OCR** - Add multimodal support via Gemini Vision, implement invoice photo upload and data extraction
   - Addresses: High-value differentiator (invoice processing)
   - Avoids: Building OCR before the basic agent works

4. **Resilience: Fallback Chain + Polish** - Implement provider fallback (Gemini -> Groq -> OpenRouter), add error handling, rate limit management, confirmation dialogs for destructive actions
   - Addresses: Production reliability, security
   - Avoids: Premature optimization

**Phase ordering rationale:**
- Chat UI must exist before tools can be demonstrated
- Tools must work before vision (vision is just another input modality)
- Fallback chain is optimization, not core functionality

**Research flags for phases:**
- Phase 2: Needs deeper research on exact BusinessHub API endpoints to expose as tools
- Phase 3: May need testing of Gemini Vision accuracy on Spanish invoices specifically
- Phase 4: Rate limit numbers may change; verify at implementation time

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Vercel AI SDK is dominant, well-documented, provider-agnostic |
| Free APIs | MEDIUM-HIGH | Rate limits verified from multiple sources but change frequently |
| Features | HIGH | Standard agent patterns well-established |
| Architecture | HIGH | Backend proxy + SSE streaming is the standard pattern |
| Pitfalls | HIGH | Well-documented in OWASP and community sources |
| Vision/OCR | MEDIUM | Gemini Vision is strong but accuracy on Spanish invoices unverified |

## Gaps to Address

- Exact Gemini Vision accuracy on Latin American invoice formats needs testing
- Firebase Cloud Functions cold start latency impact on agent responsiveness
- Whether AI SDK v6 `useChat` hook works seamlessly with non-Vercel backends (high probability but needs validation)
- Long-term sustainability of free tiers (Google reduced limits in Dec 2025)
