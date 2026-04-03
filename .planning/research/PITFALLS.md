# Domain Pitfalls

**Domain:** AI agent embedded in business web application
**Researched:** 2026-04-03

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Exposing API Keys Client-Side
**What goes wrong:** LLM API keys placed in React environment variables (VITE_*) are bundled into the client-side JavaScript and visible to anyone opening browser DevTools.
**Why it happens:** Developer convenience. VITE_ prefix makes env vars available in the browser. Easy to accidentally use `import.meta.env.VITE_GEMINI_KEY`.
**Consequences:** API key theft, unauthorized usage billed to your account, potential abuse of the key for unrelated purposes.
**Prevention:** ALL LLM calls go through Firebase Cloud Functions. API keys live only in `functions:config` or Cloud Secret Manager. Never create a VITE_* variable for any API key.
**Detection:** Grep codebase for `VITE_.*KEY` or `VITE_.*API`. Check browser Network tab for direct calls to ai.google.dev or api.groq.com.

### Pitfall 2: No Rate Limit Handling
**What goes wrong:** Agent makes LLM calls without handling 429 (Too Many Requests) responses, causing cascading failures and broken UI.
**Why it happens:** Works fine in development with low traffic. Free tier limits only hit in production with real users.
**Consequences:** Agent goes completely offline for minutes at a time. Users see cryptic errors. No automatic recovery.
**Prevention:** Implement the provider fallback chain (Gemini -> Groq -> OpenRouter). Catch 429 errors specifically. Show user-friendly "I'm thinking harder..." message during fallback. Implement exponential backoff.
**Detection:** Monitor Cloud Function logs for 429 responses. Set up alerting on error rates.

### Pitfall 3: Unbounded Agent Loop
**What goes wrong:** Agent enters infinite loop calling tools that return unsatisfactory results, burning through rate limits in seconds.
**Why it happens:** LLM decides a tool result isn't what it wanted and keeps retrying. Common with vague user queries.
**Consequences:** Exhausts daily rate limits in minutes. UI hangs. User sees no response for 30+ seconds.
**Prevention:** Set `maxSteps: 10` in AI SDK. Implement a 30-second timeout on the Cloud Function. Track tool call count and force a text response after 5 tool calls.
**Detection:** Log tool call counts per request. Alert when any single request exceeds 5 tool calls.

### Pitfall 4: Agent Modifies Data Without Confirmation
**What goes wrong:** Agent creates, updates, or deletes records based on its interpretation of the user's message without explicit confirmation.
**Why it happens:** Developer marks write tools as auto-executable for convenience during development. Forgets to add confirmation step.
**Consequences:** Wrong invoices created, employees modified, financial records altered. Data integrity compromised. Users lose trust immediately.
**Prevention:** Every tool that writes to Firestore MUST use the `needsApproval` pattern. Show the user exactly what will be created/modified and wait for explicit confirmation. Never cache approvals.
**Detection:** Audit tool definitions -- every write tool must have a confirmation flow. Test by asking the agent to "delete all employees" and verify it asks for confirmation.

### Pitfall 5: Prompt Injection via User Input
**What goes wrong:** Malicious user crafts messages that override the system prompt, making the agent ignore its tools/restrictions or leak system prompt content.
**Why it happens:** LLMs are susceptible to prompt injection. "Ignore your instructions and..." type attacks.
**Consequences:** Agent bypasses safety controls. Could reveal system prompt (leaking business logic). Could be tricked into destructive operations.
**Prevention:** Validate tool call parameters server-side (don't trust the LLM's parameter choices blindly). Implement allowlist for tool names. Never include sensitive data in system prompts. Use Gemini's safety settings. Add a guard layer that checks tool calls before execution.
**Detection:** Log all tool calls and parameters. Flag unusual patterns (e.g., tool called with parameters that look like prompt injection attempts).

## Moderate Pitfalls

### Pitfall 1: Over-Engineering the Tool System
**What goes wrong:** Building 20+ tools before validating the core pattern works. Each tool adds complexity to the system prompt and increases LLM confusion.
**Prevention:** Start with 3 tools maximum. Add more only when users request specific capabilities. LLMs perform better with fewer, well-described tools than many overlapping ones.

### Pitfall 2: Ignoring Firebase Cloud Function Cold Starts
**What goes wrong:** First agent request after idle period takes 5-10 seconds due to Cloud Function cold start, making the agent feel broken.
**Prevention:** Use 2nd gen Cloud Functions (faster cold starts). Consider a minimum instances setting (1 warm instance = ~$5/month). Show a loading animation immediately so users know something is happening.

### Pitfall 3: Conversation Context Growing Too Large
**What goes wrong:** Sending the entire conversation history with every request. After 20+ messages, token count exceeds limits or gets expensive.
**Prevention:** Implement a sliding window: keep last 10 messages + system prompt. Summarize older messages. Monitor token counts per request.

### Pitfall 4: Not Handling Image Upload Failures
**What goes wrong:** User uploads a blurry/corrupt invoice image. Gemini Vision returns garbage. Agent presents extracted data with confidence.
**Prevention:** Add validation: if Gemini's response confidence is low or extracted fields are incomplete, ask the user to retake the photo. Never auto-create records from uncertain OCR results.

### Pitfall 5: Mixing Languages in System Prompt
**What goes wrong:** System prompt in English but users interact in Spanish. Agent sometimes responds in English or mixes languages.
**Prevention:** Write the entire system prompt in Spanish. Include explicit instruction: "SIEMPRE responde en espanol." Test with Spanish-language queries.

### Pitfall 6: Not Gracefully Handling LLM Hallucinations
**What goes wrong:** Agent invents financial data or employee names that don't exist, presenting them as real.
**Prevention:** Agent MUST use tools to query real data. System prompt should include: "Nunca inventes datos. Si no puedes encontrar la informacion, dilo claramente." All data-related responses must come from tool results, not LLM knowledge.

## Minor Pitfalls

### Pitfall 1: Chat Panel Blocks Main App Usage
**What goes wrong:** Full-screen chat modal prevents users from referencing the data they want to ask about.
**Prevention:** Use a slide-out panel or floating chat that doesn't block the main content. Users need to see their data while talking to the agent.

### Pitfall 2: No Loading States for Tool Execution
**What goes wrong:** Agent calls a tool, and the user sees nothing for 2-3 seconds. Feels broken.
**Prevention:** Show tool execution indicators: "Buscando empleados..." "Consultando finanzas..." These should appear the instant a tool call is detected in the stream.

### Pitfall 3: Losing Chat on Navigation
**What goes wrong:** User navigates to a different module and their conversation disappears.
**Prevention:** Keep chat state in a top-level React context or zustand store that persists across route changes.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Backend proxy setup | Cold start latency | Use 2nd gen functions, show loading state |
| Basic chat UI | Chat blocks main content | Use slide-out panel, not modal |
| Function calling | Too many tools | Start with 3 maximum |
| Invoice OCR | Poor image quality handling | Validate OCR confidence, ask for retake |
| Fallback chain | Testing all providers | Create integration tests for each provider |
| Production hardening | Prompt injection | Server-side validation of all tool parameters |
| Spanish language | Mixed language responses | Full Spanish system prompt |

## Sources

- https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows/
- https://www.digitalapplied.com/blog/ai-agent-security-best-practices-2025
- https://mbrenndoerfer.com/writing/action-restrictions-and-permissions-ai-agents
- https://medium.com/@oracle_43885/owasps-ai-agent-security-top-10-agent-security-risks-2026
- https://www.kaspersky.com/blog/top-agentic-ai-risks-2026/55184/
