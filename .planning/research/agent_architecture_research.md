# AI Agent Architecture Research for BusinessHub

**Researched:** 2026-04-03
**Domain:** Embedded AI agent in React + Vite + Firebase web application
**Constraint:** No Next.js, no server -- client-side + Firebase Cloud Functions only
**Overall Confidence:** HIGH (cross-referenced official docs, SDKs, and community patterns)

---

## Executive Summary

Building a production AI agent into BusinessHub requires three decisions: the framework, the architecture pattern, and the deployment strategy. After researching the ecosystem, the recommendation is:

1. **Framework:** Vercel AI SDK (`ai` package) -- lightest weight, best React integration, works with any Node.js backend including Firebase Cloud Functions. Not locked to Next.js despite the name.
2. **Architecture:** Function-calling agent loop (not classical ReAct). Modern LLMs with native tool-calling APIs have made the ReAct prompt pattern unnecessary. The agent loop is: user message -> LLM decides tool calls -> execute tools -> return results -> LLM generates final response.
3. **Deployment:** Firebase Cloud Functions (2nd gen) with streaming callable functions. The agent logic runs server-side (Cloud Functions), the React client uses `useChat` from `@ai-sdk/react` or Firebase's native streaming callable.

---

## 1. Agent Architecture Patterns

### Pattern Comparison

| Pattern | Description | When to Use | Complexity |
|---------|-------------|-------------|------------|
| **Single LLM call** | One prompt, one response | Simple Q&A, summaries | Low |
| **Function-calling loop** | LLM calls tools iteratively until done | CRUD operations, data queries | Medium |
| **ReAct (Reason+Act)** | Explicit think-act-observe prompt chain | Complex multi-step reasoning | High |
| **Plan-and-Execute** | LLM creates plan, then executes steps | Long workflows, report generation | High |
| **Multi-Agent** | Multiple specialized agents collaborate | Large systems with distinct domains | Very High |

### Recommendation: Function-Calling Agent Loop

For BusinessHub, the **function-calling agent loop** is the right pattern. Here is why:

- The tasks are well-defined CRUD operations (create employee, add transaction, query data).
- Modern models (Gemini, GPT-4o, Claude) have native function-calling that replaces ReAct's text-based reasoning.
- It is simpler to implement, debug, and maintain than ReAct.
- It naturally supports confirmation dialogs (intercept tool calls before execution).

**How it works:**

```
User: "Add a new employee named Maria Lopez, accountant, salary 35000"
  |
  v
LLM receives: system prompt + user message + available tools
  |
  v
LLM responds with: tool_call("createEmployee", { name: "Maria Lopez", ... })
  |
  v
System: Shows confirmation to user -> User approves -> Executes tool
  |
  v
Tool result returned to LLM
  |
  v
LLM generates final response: "Done. Maria Lopez has been added as Accountant."
```

**Multi-step example:**

```
User: "Show me this month's expenses and create a summary report"
  |
  v
LLM: tool_call("getExpenses", { period: "2026-04" })
  -> Result: [{ vendor: "AWS", amount: 150 }, ...]
  |
  v
LLM: tool_call("generateReport", { type: "expense_summary", data: [...] })
  -> Result: { reportId: "abc123", url: "/reports/abc123" }
  |
  v
LLM: "Here's your April expense summary. Total: $2,340 across 15 transactions.
       View the full report: /reports/abc123"
```

The `maxSteps` parameter in Vercel AI SDK controls how many tool-call rounds the agent can perform (recommend: 5-8 for BusinessHub).

**Confidence: HIGH** -- this is the standard production pattern used by ChatGPT, Claude, Gemini, and all major chat products.

---

## 2. Framework Comparison

### Vercel AI SDK vs LangChain.js vs Raw Fetch

| Criterion | Vercel AI SDK | LangChain.js | Raw Fetch + SSE |
|-----------|--------------|--------------|-----------------|
| **Bundle size** | ~15 KB (core) | ~101 KB gzipped | 0 KB (native) |
| **React integration** | `useChat`, `useCompletion` hooks | Manual integration needed | Manual everything |
| **Tool calling** | `tool()` helper with Zod schemas | Agents with tool definitions | Parse JSON manually |
| **Streaming** | Built-in SSE streaming | AsyncIterator-based | Manual EventSource/fetch |
| **Multi-provider** | 25+ providers, unified API | 20+ providers, unified API | Separate code per provider |
| **TypeScript** | First-class, Zod schemas | Good but heavier types | Manual typing |
| **Learning curve** | Low | High (many abstractions) | Medium (more code) |
| **Maintenance burden** | Low (small API surface) | High (frequent breaking changes) | Medium (your code) |
| **Firebase Functions** | Works with Express adapter | Works but heavy | Works natively |
| **Latency overhead** | ~30ms p99 | ~50ms p99 | Minimal |

### Recommendation: Vercel AI SDK

**Use Vercel AI SDK** because:

1. **Lightest weight.** The core `ai` package is small. The React hooks (`@ai-sdk/react`) add minimal overhead.
2. **Best DX for React.** `useChat` handles message state, streaming, tool call rendering, and error states out of the box.
3. **Not locked to Next.js.** Works with Express, Node.js HTTP, and any framework. Firebase Cloud Functions are just Node.js -- the SDK works perfectly there.
4. **Provider-agnostic.** Already compatible with the free providers from the previous research (Gemini, Groq, Mistral via `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/mistral`).
5. **Tool calling is clean.** Define tools with Zod schemas, get type-safe parameters in the execute function.

**Do NOT use LangChain.js** because:
- It is heavyweight (101 KB gzipped).
- It has a steep learning curve with many abstractions (chains, agents, memory, callbacks).
- Breaking changes are frequent between versions.
- Its value is in complex RAG pipelines and multi-agent orchestration -- overkill for BusinessHub's CRUD agent.
- Bundle size blocks edge runtime deployment.

**Do NOT build from scratch** because:
- Streaming SSE parsing, tool call protocol handling, and message state management is significant boilerplate.
- The Vercel AI SDK solves all of this in a maintained, tested library.
- The time saved is substantial for a solo developer.

### Installation

```bash
# Core SDK
npm install ai @ai-sdk/react

# Providers (from free_llm_apis_research.md)
npm install @ai-sdk/google @ai-sdk/groq @ai-sdk/mistral

# For tool schemas
npm install zod
```

**Confidence: HIGH** -- verified via official docs, npm downloads, and community comparisons.

---

## 3. Function Calling / Tool Use Patterns

### Defining Tools with Vercel AI SDK

The `tool()` helper from the AI SDK provides the cleanest pattern for defining agent tools:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

// Tool definition pattern
const createEmployeeTool = tool({
  description: 'Create a new employee in the BusinessHub system',
  parameters: z.object({
    name: z.string().describe('Full name of the employee'),
    position: z.string().describe('Job title'),
    department: z.string().optional().describe('Department name'),
    salary: z.number().describe('Monthly salary in local currency'),
    startDate: z.string().describe('Start date in YYYY-MM-DD format'),
  }),
  // execute is OPTIONAL -- omit it to handle execution client-side
  // This enables confirmation dialogs before execution
});
```

### Key Pattern: Server-Side Definition, Client-Side Execution

For destructive operations that need user confirmation, **do not provide an `execute` function** in the tool definition. Instead:

1. The LLM returns a `tool_call` with the parameters.
2. The client renders a confirmation dialog showing what will happen.
3. The user approves or rejects.
4. On approval, the client executes the action and sends the result back.

This is the **"human-in-the-loop" pattern** and is critical for security.

```typescript
// Server-side: Define tools WITHOUT execute (for destructive actions)
const tools = {
  createEmployee: tool({
    description: 'Create a new employee',
    parameters: z.object({ /* ... */ }),
    // No execute function -- client handles it
  }),
  getEmployees: tool({
    description: 'List employees with optional filters',
    parameters: z.object({ /* ... */ }),
    execute: async (params) => {
      // READ operations can auto-execute server-side
      return await db.collection('employees').where(/* ... */).get();
    },
  }),
};
```

### Tool Categories by Risk Level

| Category | Risk | Confirmation? | Execute Location |
|----------|------|---------------|------------------|
| **Read** (get employees, query finances) | LOW | No | Server auto-execute |
| **Create** (add employee, add transaction) | MEDIUM | Yes, show preview | Client after approval |
| **Update** (edit salary, change status) | MEDIUM | Yes, show diff | Client after approval |
| **Delete** (remove employee, void invoice) | HIGH | Yes, explicit warning | Client after double-confirm |
| **Bulk** (import CSV, batch update) | HIGH | Yes, show summary count | Client after approval |

### Tool Result Handling

Tools should return structured results that the LLM can use to generate a helpful response:

```typescript
// Good: Structured result with context
return {
  success: true,
  employee: { id: 'emp_123', name: 'Maria Lopez' },
  message: 'Employee created successfully',
};

// Bad: Just a boolean
return true;
```

**Confidence: HIGH** -- this is the documented pattern from Vercel AI SDK and aligns with OpenAI/Anthropic/Google tool-calling protocols.

---

## 4. Agent UX Patterns

### 4.1 Chat Interface with Streaming

The `useChat` hook from `@ai-sdk/react` manages the full chat lifecycle:

```typescript
import { useChat } from '@ai-sdk/react';

function AgentChat() {
  const {
    messages,      // Full message history
    input,         // Current input value
    handleSubmit,  // Form submit handler
    handleInputChange,
    isLoading,     // True while streaming
    error,         // Error state
    addToolResult, // Send tool execution results back
  } = useChat({
    api: '/api/agent/chat', // Your Firebase Cloud Function endpoint
    maxSteps: 5,
  });
}
```

### 4.2 Showing Tool Execution Steps

When the agent calls tools, `useChat` exposes tool invocations in the message parts. This enables rendering execution steps to the user:

```typescript
// Inside message rendering
{message.parts?.map((part, i) => {
  if (part.type === 'tool-invocation') {
    return <ToolStep key={i} invocation={part} />;
  }
  if (part.type === 'text') {
    return <TextBubble key={i} text={part.text} />;
  }
})}
```

The `ToolStep` component shows what the agent is doing:
- **Pending:** "Looking up employee records..." (spinner)
- **Executing:** "Creating employee Maria Lopez..." (progress)
- **Complete:** "Employee created" (checkmark + summary card)
- **Failed:** "Could not create employee: duplicate name" (error + retry button)

### 4.3 Confirmation Dialogs Before Destructive Actions

The recommended UX flow for destructive operations:

1. Agent responds with tool call (no auto-execute).
2. UI renders a **confirmation card** showing:
   - Action name ("Create Employee")
   - Parameters as a readable summary (not raw JSON)
   - "Approve" and "Cancel" buttons
3. User clicks Approve -> client executes the action -> sends result via `addToolResult`.
4. User clicks Cancel -> sends a cancellation result -> LLM acknowledges.

This maps to the "Intent Preview" UX pattern from Smashing Magazine's agentic AI research -- show what will happen before it happens.

### 4.4 Autonomy Levels

Implement a user-configurable autonomy setting:

| Level | Read Operations | Create/Update | Delete |
|-------|----------------|---------------|--------|
| **Conservative** | Auto-execute | Always confirm | Always confirm |
| **Balanced** | Auto-execute | Auto-execute | Always confirm |
| **Autonomous** | Auto-execute | Auto-execute | Auto-execute |

Default to **Conservative** for new users. Let them upgrade trust over time.

### 4.5 Progress Indicators

- **Streaming text:** Show a blinking cursor at the end of the growing text.
- **Tool execution:** Show a step-by-step progress bar (Step 1 of 3: Querying data...).
- **Long operations:** Show elapsed time and option to cancel.

### 4.6 Error Handling UX

| Error Type | UX Response |
|------------|-------------|
| Rate limited | "I'm a bit busy right now. Trying another provider..." (auto-fallback, invisible to user) |
| Provider down | Same as above -- transparent fallback |
| All providers fail | "I can't connect to my AI service right now. Please try again in a minute." |
| Tool execution error | "I tried to create the employee but got an error: [readable message]. Want me to try again?" |
| Invalid user input | "I need a bit more information. What department should Maria be in?" |

**Confidence: HIGH** -- patterns verified from Microsoft Design, Smashing Magazine, and patterns.dev references on agentic AI UX.

---

## 5. Security Considerations

### 5.1 Architecture: API Keys NEVER in Client

**Critical:** LLM API keys must live in Firebase Cloud Functions environment config, never in the client bundle. The agent flow is:

```
React Client  ---->  Firebase Cloud Function  ---->  LLM Provider
(no API keys)        (has API keys)                  (Gemini, Groq, etc.)
```

### 5.2 Tool Sandboxing

Define an explicit allowlist of tools the agent can use. Never give the agent open-ended capabilities:

```typescript
// GOOD: Explicit tool registry
const ALLOWED_TOOLS = {
  getEmployees: /* ... */,
  createEmployee: /* ... */,
  getTransactions: /* ... */,
  // Explicitly listed, nothing else
};

// BAD: Dynamic tool loading or eval
const tool = await import(userProvidedToolName); // NEVER
```

Restrict tool parameters:
- File paths: only allow `/uploads/*`, block `*.env`, `*.key`
- Database queries: scope to the authenticated user's company
- No shell execution, no arbitrary code eval

### 5.3 User Confirmation Before Mutations

As described in Section 4.3, all create/update/delete operations must require user confirmation. This is both a UX and security pattern -- it prevents the agent from being tricked into destructive actions via prompt injection.

### 5.4 Prompt Injection Prevention

Layer multiple defenses (OWASP AI Agent Security Cheat Sheet):

1. **System prompt isolation:** Use clear delimiters between instructions and user input.
2. **Input sanitization:** Strip known injection patterns before passing to the LLM.
3. **Output validation:** Validate tool call parameters against Zod schemas before execution.
4. **Scope limitation:** The agent can only call pre-defined tools. Even if injected, it cannot access arbitrary APIs.
5. **Context isolation:** Never include raw user-uploaded documents directly in the system prompt. Process them in a separate, sandboxed LLM call first.

```typescript
// Input sanitization example
function sanitizeUserInput(input: string): string {
  // Remove common injection patterns
  const patterns = [
    /ignore previous instructions/gi,
    /system:\s*/gi,
    /\[INST\]/gi,
    /<\|system\|>/gi,
  ];
  let sanitized = input;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  return sanitized.trim();
}
```

### 5.5 Rate Limiting

Implement per-user rate limiting in Firebase Cloud Functions:

| Limit | Value | Purpose |
|-------|-------|---------|
| Messages per minute | 10 | Prevent abuse |
| Messages per hour | 100 | Cost control |
| Tool calls per session | 20 | Prevent runaway agent loops |
| Cost per session | $0.10 | Denial-of-wallet prevention |

Use Firestore to track usage per user with TTL documents.

### 5.6 Authentication

Every Cloud Function call must verify the Firebase Auth token. The agent only accesses data belonging to the authenticated user's company.

**Confidence: HIGH** -- based on OWASP AI Agent Security Cheat Sheet, NVIDIA sandboxing guide, and Trail of Bits research.

---

## 6. Multi-Provider Fallback Strategy

This was thoroughly covered in `free_llm_apis_research.md`. The key code pattern using Vercel AI SDK:

```typescript
// Simplified fallback pattern
async function callWithFallback(prompt: string, tools: Record<string, any>) {
  const providers = [
    { model: google('gemini-2.5-flash'), name: 'gemini' },
    { model: groq('llama-3.3-70b-versatile'), name: 'groq' },
    { model: mistral('mistral-small-latest'), name: 'mistral' },
  ];

  for (const provider of providers) {
    if (isRateLimited(provider.name)) continue;
    try {
      return await streamText({
        model: provider.model,
        messages: /* ... */,
        tools,
        maxSteps: 5,
      });
    } catch (error) {
      if (isRateLimitError(error)) {
        markRateLimited(provider.name, parseRetryAfter(error));
        continue;
      }
      throw error;
    }
  }
  throw new Error('All AI providers unavailable');
}
```

The Vercel AI SDK makes this clean because all providers share the same `streamText`/`generateText` API. You just swap the `model` parameter.

**Confidence: HIGH** -- pattern verified from multiple production guides and the existing free_llm_apis_research.md.

---

## 7. Streaming Responses

### Option Comparison

| Approach | Works with Firebase? | Complexity | Real-time? |
|----------|---------------------|------------|------------|
| **Firebase Callable Streaming** (sendChunk) | Native | Low | Yes |
| **Vercel AI SDK + Express on Cloud Functions** | Yes (2nd gen HTTP) | Medium | Yes |
| **Raw SSE via HTTP Cloud Functions** | Yes (2nd gen) | Medium | Yes |
| **WebSockets** | No (Cloud Functions don't support) | N/A | N/A |
| **Firestore real-time listeners** | Yes | Low | Near real-time |

### Recommendation: Two Viable Approaches

**Option A: Firebase Callable Streaming (Simplest)**

Firebase's new streaming callable functions (2025) work natively with the Firebase client SDK:

```typescript
// Cloud Function (server)
import { onCall } from 'firebase-functions/v2/https';

export const agentChat = onCall(async (request, response) => {
  const { messages } = request.data;
  
  // Use Vercel AI SDK server-side
  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages,
    tools: agentTools,
    maxSteps: 5,
  });

  // Stream chunks to client
  for await (const chunk of result.textStream) {
    if (request.acceptsStreaming) {
      response.sendChunk({ type: 'text', content: chunk });
    }
  }

  return { complete: true, toolResults: result.toolResults };
});

// Client
import { getFunctions, httpsCallable } from 'firebase/functions';

const agentChat = httpsCallable(getFunctions(), 'agentChat');
const { stream, data } = await agentChat.stream({ messages });

for await (const chunk of stream) {
  appendToUI(chunk.content);
}
```

**Option B: HTTP Cloud Function + Vercel AI SDK useChat (Richest features)**

Deploy a 2nd gen HTTP Cloud Function that acts as an Express endpoint, and use `useChat` from `@ai-sdk/react` on the client:

```typescript
// Cloud Function (server) - 2nd gen HTTP function
import { onRequest } from 'firebase-functions/v2/https';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

export const agentChat = onRequest(
  { cors: true, timeoutSeconds: 120 },
  async (req, res) => {
    const { messages } = req.body;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: 'You are a helpful business assistant for BusinessHub...',
      messages,
      tools: agentTools,
      maxSteps: 5,
    });

    // This pipes SSE-formatted stream directly to the response
    result.pipeUIMessageStreamToResponse(res);
  }
);

// Client
import { useChat } from '@ai-sdk/react';

function AgentChat() {
  const { messages, input, handleSubmit, isLoading } = useChat({
    api: 'https://us-central1-businesshub.cloudfunctions.net/agentChat',
    maxSteps: 5,
  });
  // Full streaming chat UI with tool call rendering
}
```

### Which Streaming Approach to Choose

| Factor | Firebase Callable Streaming | HTTP + useChat |
|--------|---------------------------|----------------|
| Setup complexity | Lower (native Firebase SDK) | Medium (CORS, auth middleware) |
| Tool call rendering | Manual (parse chunks) | Built-in (message parts) |
| Authentication | Automatic (Firebase Auth) | Manual (pass token in headers) |
| Confirmation dialogs | Manual implementation | `addToolResult` built-in |
| Message history | Manual state management | `useChat` manages it |
| Provider fallback | Manual | Manual (same either way) |

**Recommendation:** Use **Option B (HTTP + useChat)** for the richer agent experience. The `useChat` hook's built-in tool call handling, message state management, and `addToolResult` for confirmation dialogs saves significant development time. The extra CORS/auth setup is a one-time cost.

**Confidence: HIGH** -- Firebase callable streaming verified from official Firebase blog (March 2025). Vercel AI SDK Express pattern verified from official docs.

---

## 8. Deployment Architecture

```
+-------------------+      HTTPS (SSE stream)      +------------------------+
|                   | ----------------------------> |                        |
|  React Client     |                               |  Firebase Cloud        |
|  (Vite + SPA)     | <---------------------------- |  Function (2nd gen)    |
|                   |      Streaming response        |                        |
|  - useChat hook   |                               |  - Vercel AI SDK       |
|  - Tool confirm   |                               |  - Tool definitions    |
|  - Message UI     |                               |  - Fallback chain      |
|                   |                               |  - Rate limiting       |
+-------------------+                               +------------------------+
        |                                                    |
        |  Firestore                                         |  API calls
        |  (read data for display)                           |  (LLM providers)
        v                                                    v
+-------------------+                               +------------------------+
|                   |                               |  Gemini / Groq /       |
|  Firestore DB     | <--- Tool execution --------- |  Mistral / OpenRouter  |
|                   |                               +------------------------+
+-------------------+
```

### Key Architecture Decisions

1. **Agent logic lives in Cloud Functions**, not the client. This keeps API keys secure and allows rate limiting.
2. **Tool execution happens server-side** for read operations. For mutations, the Cloud Function returns the tool call to the client for confirmation, then the client sends the approved action back.
3. **Firestore is the data layer.** The agent reads/writes through the same Firestore collections that the rest of the app uses.
4. **No separate AI server.** Firebase Cloud Functions are the only backend needed.

---

## 9. Implementation Phases

### Phase 1: Foundation (Estimated: 1-2 weeks)
- Set up Cloud Function with Vercel AI SDK
- Implement basic `streamText` with Gemini
- Create `useChat`-based chat component
- Simple text responses, no tools

### Phase 2: Tool Calling (Estimated: 2-3 weeks)
- Define read-only tools (getEmployees, getTransactions, getKPIs)
- Implement tool execution in Cloud Function
- Render tool steps in chat UI
- Add fallback chain (Gemini -> Groq -> Mistral)

### Phase 3: Mutations with Confirmation (Estimated: 1-2 weeks)
- Define mutation tools without `execute` (createEmployee, addTransaction)
- Build confirmation dialog components
- Implement `addToolResult` flow
- Add user autonomy settings

### Phase 4: Polish and Security (Estimated: 1-2 weeks)
- Rate limiting per user
- Input sanitization
- Error handling UX
- Mobile-responsive chat UI
- Usage tracking in Firestore

---

## 10. Anti-Patterns to Avoid

### Do NOT expose API keys to the client
Even "free" API keys can be abused. Always proxy through Cloud Functions.

### Do NOT use LangChain for this use case
LangChain is for complex RAG pipelines and multi-agent orchestration. BusinessHub needs a simple tool-calling agent. LangChain would add ~100KB of bundle size and significant complexity for no benefit.

### Do NOT auto-execute mutations
Every create/update/delete operation must go through user confirmation. This is both a security requirement and a trust-building UX pattern.

### Do NOT stream through Firestore
A pattern some tutorials suggest is writing LLM tokens to a Firestore document and using `onSnapshot` to stream them. This is slow (Firestore has ~500ms latency per write), expensive (one write per token), and unnecessary when SSE streaming works directly.

### Do NOT use WebSockets with Cloud Functions
Firebase Cloud Functions do not support WebSocket connections. Use SSE (Server-Sent Events) via HTTP streaming or Firebase callable streaming instead.

### Do NOT send entire Firestore collections to the LLM
Use tools to query specific data. The agent should call `getEmployees({ department: 'Engineering' })`, not receive the entire employees collection in its context.

---

## Sources

### Official Documentation
- [Vercel AI SDK Introduction](https://ai-sdk.dev/docs/introduction)
- [Vercel AI SDK useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [Vercel AI SDK Express Example](https://ai-sdk.dev/examples/api-servers/express)
- [Vercel AI SDK streamText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [AI SDK 4.2 Release](https://vercel.com/blog/ai-sdk-4-2)
- [AI SDK 5 Release](https://vercel.com/blog/ai-sdk-5)
- [Firebase Streaming Cloud Functions Blog](https://firebase.blog/posts/2025/03/streaming-cloud-functions-genkit/)
- [Firebase Callable Functions Docs](https://firebase.google.com/docs/functions/callable)
- [Firebase onCallGenkit Docs](https://firebase.google.com/docs/functions/oncallgenkit)

### Security
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
- [NVIDIA Sandboxing Agentic Workflows](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/)
- [Trail of Bits: Prompt Injection to RCE](https://blog.trailofbits.com/2025/10/22/prompt-injection-to-rce-in-ai-agents/)
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)

### UX Patterns
- [Smashing Magazine: Designing for Agentic AI (Feb 2026)](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/)
- [Microsoft Design: UX for Agents](https://microsoft.design/articles/ux-design-for-agents/)
- [Google A2UI Project](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [Agentic Design Patterns](https://agentic-design.ai/patterns/ui-ux-patterns)
- [patterns.dev: AI UI Patterns](https://www.patterns.dev/react/ai-ui-patterns/)

### Architecture
- [Google Cloud: Choose a Design Pattern for Agentic AI](https://docs.google.com/architecture/choose-design-pattern-agentic-ai-system)
- [IBM: What is a ReAct Agent?](https://www.ibm.com/think/topics/react-agent)
- [AI Agent Architecture Patterns 2025](https://fast.io/resources/ai-agent-architecture-patterns/)

### Comparisons
- [LangChain vs Vercel AI SDK vs OpenAI SDK: 2026 Guide](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)
- [AI Framework Comparison: Vercel AI SDK, Mastra, Langchain, Genkit](https://komelin.com/blog/ai-framework-comparison)
- [Comparing AI SDKs for React](https://dev.to/brayancodes/comparing-ai-sdks-for-react-vercel-langchain-hugging-face-5g66)

### Multi-Provider Fallback
- [Retries, Fallbacks, and Circuit Breakers in LLM Apps](https://www.getmaxim.ai/articles/retries-fallbacks-and-circuit-breakers-in-llm-apps-a-production-guide/)
- [Failover Routing Strategies for LLMs](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/)
- [Circuit Breaker for LLM with Retry and Backoff (TypeScript)](https://medium.com/@spacholski99/circuit-breaker-for-llm-with-retry-and-backoff-anthropic-api-example-typescript-1f99a0a0cf87)
