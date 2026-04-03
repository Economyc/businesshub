# Feature Landscape

**Domain:** AI assistant embedded in business management app
**Researched:** 2026-04-03

## Table Stakes

Features users expect from an AI assistant in a business app. Missing = feels like a toy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Natural language chat | Core interaction mode | Low | Vercel AI SDK useChat handles this |
| Streaming responses | Users expect real-time text generation | Low | SSE streaming built into AI SDK |
| Query business data | "How much revenue this month?" | Medium | Requires function calling tools that query Firestore |
| Context awareness | Agent knows which module user is viewing | Low | Pass current route/context in system prompt |
| Error handling | Graceful failures when API is down | Medium | Fallback chain + user-friendly error messages |
| Conversation history | Remember what was discussed in session | Low | Maintained in React state via useChat |
| Mobile-friendly chat | Responsive chat panel | Low | Standard responsive CSS |

## Differentiators

Features that set BusinessHub apart. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Invoice OCR via photo | Snap invoice photo, agent extracts data | Medium | Gemini Vision API, image upload in chat |
| Create records via chat | "Add employee Juan Perez" | Medium | Function calling with confirmation step |
| Financial insights | "Compare Q1 vs Q2 expenses" | Medium | Tool that queries + aggregates Firestore data |
| Multi-step workflows | "Generate payroll report and email it" | High | Agent loop with multiple tool calls |
| Contextual suggestions | Agent proactively suggests actions based on current view | Medium | System prompt engineering per module |
| Spanish-first | Fluent Spanish interaction, understands Latin American business terms | Low | Gemini handles Spanish natively, system prompt in Spanish |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Autonomous bulk operations | Deleting/modifying many records without oversight is dangerous | Always require per-action confirmation for writes |
| Custom model training | Expensive, unnecessary for this use case | Use prompt engineering and RAG instead |
| Voice input/output | Adds complexity, low ROI for business app | Start with text-only, add voice later if demanded |
| Multi-agent system | Over-engineering for a single-app assistant | Single agent with tools is sufficient |
| Persistent long-term memory | Complex to build correctly, privacy concerns | Session-based memory only; user can start fresh |
| Code generation/execution | Security nightmare in a business app | Agent should use predefined tools, never generate arbitrary code |

## Feature Dependencies

```
Streaming Chat -> Function Calling Tools -> Invoice OCR
                                        -> Record Creation
                                        -> Financial Queries
                                        
Context Awareness -> Contextual Suggestions

Function Calling -> Multi-step Workflows (requires reliable single-step first)
```

## MVP Recommendation

Prioritize:
1. **Streaming chat with Gemini** - Foundation, proves the concept works
2. **3 core tools**: Query revenue/expenses, search employees, get KPI summary
3. **Invoice OCR** - Highest-impact differentiator, users can photograph invoices
4. **Record creation via chat** - "Add this invoice" after OCR extraction

Defer:
- Multi-step workflows: Wait until single tools are reliable
- Contextual suggestions: Nice-to-have, not essential for MVP
- Email/notification integration: Requires additional infrastructure

## Sources

- https://fuselabcreative.com/ui-design-for-ai-agents/
- https://microsoft.design/articles/ux-design-for-agents/
- https://www.groovyweb.co/blog/ui-ux-design-trends-ai-apps-2026
