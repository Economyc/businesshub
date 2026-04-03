# Architecture Patterns

**Domain:** AI agent embedded in business web application
**Researched:** 2026-04-03

## Recommended Architecture

```
[React App (Vite)]                    [Firebase Cloud Functions]
       |                                       |
  useChat() hook  -- SSE stream -->  /api/agent endpoint
       |                                       |
  Chat UI component              Agent Loop (ReAct pattern)
  Tool result display            ├── Gemini 2.5 Flash (primary)
  Confirmation dialogs           ├── Groq Llama 3.3 (fallback)
  Image upload                   ├── OpenRouter (meta-fallback)
                                 └── Tool execution
                                     ├── queryFinancials()
                                     ├── searchEmployees()
                                     ├── getKPISummary()
                                     ├── createRecord()
                                     └── processInvoiceImage()
                                              |
                                         [Firestore]
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Chat Panel (React) | UI rendering, message display, image upload, confirmation prompts | Firebase Cloud Function via SSE |
| useChat Hook | Manages conversation state, sends messages, receives stream | Chat Panel (state), Cloud Function (HTTP) |
| Agent Endpoint (Cloud Function) | Receives messages, runs agent loop, streams responses | LLM providers, Firestore, Tool functions |
| Agent Loop | ReAct pattern: reason -> act -> observe -> repeat | LLM provider, Tool registry |
| Tool Registry | Maps tool names to implementations with schemas | Agent Loop, Firestore |
| Provider Fallback | Tries primary LLM, falls back on error/rate limit | Google AI, Groq, OpenRouter |
| Firestore | Data persistence for business entities | Tool functions (read/write) |

### Data Flow

1. User types message in Chat Panel (or uploads invoice image)
2. `useChat` sends POST to `/api/agent` with message + conversation history
3. Cloud Function initializes agent loop with system prompt + tools
4. Agent loop calls LLM with ReAct prompt
5. LLM responds with either:
   - **Text response** -> streamed back to client via SSE
   - **Tool call** -> Cloud Function executes tool, feeds result back to LLM
   - **Needs confirmation** -> streams confirmation request to client, waits
6. Loop continues until LLM produces final text response (max 10 iterations)
7. Client renders streamed response, tool execution indicators, and results

### ReAct Agent Loop (Core Pattern)

```typescript
import { streamText, tool } from 'ai';
import { z } from 'zod';

// Define tools with Zod schemas
const tools = {
  queryFinancials: tool({
    description: 'Query financial data like revenue, expenses, profit for a date range',
    parameters: z.object({
      metric: z.enum(['revenue', 'expenses', 'profit', 'margin']),
      startDate: z.string().describe('ISO date string'),
      endDate: z.string().describe('ISO date string'),
    }),
    execute: async ({ metric, startDate, endDate }) => {
      // Query Firestore and return aggregated data
      return await getFinancialMetric(metric, startDate, endDate);
    },
  }),
  
  searchEmployees: tool({
    description: 'Search employees by name, department, or role',
    parameters: z.object({
      query: z.string(),
      department: z.string().optional(),
    }),
    execute: async ({ query, department }) => {
      return await searchEmployeesInFirestore(query, department);
    },
  }),

  createInvoice: tool({
    description: 'Create a new invoice record from extracted data',
    parameters: z.object({
      vendor: z.string(),
      amount: z.number(),
      date: z.string(),
      items: z.array(z.object({
        description: z.string(),
        amount: z.number(),
      })),
    }),
    // needsApproval: true  -- AI SDK v6 feature
    execute: async (data) => {
      return await createInvoiceInFirestore(data);
    },
  }),
};

// Agent endpoint
export async function handleAgentRequest(messages, imageData?) {
  const result = streamText({
    model: primaryModel,  // Gemini 2.5 Flash
    system: SYSTEM_PROMPT,
    messages,
    tools,
    maxSteps: 10,  // Max ReAct loop iterations
    // AI SDK handles the ReAct loop automatically
  });
  
  return result.toDataStreamResponse();
}
```

### Fallback Chain Pattern

```typescript
async function callWithFallback(params) {
  const providers = [
    { model: google('gemini-2.5-flash'), name: 'Gemini' },
    { model: groq('llama-3.3-70b-versatile'), name: 'Groq' },
    { model: openrouter('openrouter/free'), name: 'OpenRouter' },
  ];

  for (const provider of providers) {
    try {
      return await streamText({ ...params, model: provider.model });
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn(`${provider.name} rate limited, trying next...`);
        continue;
      }
      throw error; // Non-rate-limit errors bubble up
    }
  }
  
  throw new Error('All providers exhausted');
}
```

## Patterns to Follow

### Pattern 1: Backend Proxy for All LLM Calls
**What:** Every LLM API call goes through Firebase Cloud Functions, never from the browser.
**When:** Always. No exceptions.
**Why:** API keys must never be in client-side code. Also enables server-side tool execution with direct Firestore access.

### Pattern 2: Streaming with SSE
**What:** Use Server-Sent Events to stream agent responses token-by-token.
**When:** All agent responses.
**Why:** Perceived latency drops dramatically. Users see the agent "thinking" in real-time instead of waiting for a complete response.

### Pattern 3: Tool Execution Transparency
**What:** Show users what tools the agent is calling and their results.
**When:** Every tool invocation.
**Why:** Builds trust. Users should see "Searching employees..." or "Querying financials for Q1..." before seeing results.

### Pattern 4: Confirmation Before Writes
**What:** Any tool that creates, updates, or deletes data requires explicit user confirmation.
**When:** All write operations.
**Why:** Prevents accidental data modification. The agent shows what it intends to do and waits for approval.

```typescript
// In the chat UI, render confirmation cards
if (toolInvocation.state === 'needs-confirmation') {
  return (
    <ConfirmationCard
      action={toolInvocation.toolName}
      data={toolInvocation.args}
      onConfirm={() => confirmToolExecution(toolInvocation.id)}
      onReject={() => rejectToolExecution(toolInvocation.id)}
    />
  );
}
```

### Pattern 5: Context-Aware System Prompt
**What:** Include the user's current module/page context in the system prompt.
**When:** Every agent interaction.
**Why:** Allows the agent to give contextually relevant responses without the user specifying where they are.

```typescript
const systemPrompt = `
Eres el asistente AI de BusinessHub. El usuario está actualmente en el módulo de ${currentModule}.
Tienes acceso a las siguientes herramientas...
Responde siempre en español.
`;
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side LLM Calls
**What:** Calling LLM APIs directly from the React app.
**Why bad:** Exposes API keys in browser DevTools. Anyone can steal them.
**Instead:** Always proxy through Firebase Cloud Functions.

### Anti-Pattern 2: Unbounded Agent Loops
**What:** Letting the agent loop indefinitely.
**Why bad:** Can burn through rate limits, hang the UI, and confuse users.
**Instead:** Set `maxSteps: 10` and implement timeout (30 seconds max).

### Anti-Pattern 3: Over-Complicated Tool Schemas
**What:** Tools with 15+ parameters and deep nesting.
**Why bad:** LLMs make more errors with complex schemas. Tool call failure rate increases.
**Instead:** Keep tools simple (3-5 parameters max). Split complex operations into multiple simpler tools.

### Anti-Pattern 4: Storing Full Conversations in Firestore
**What:** Persisting every message to the database.
**Why bad:** Privacy concerns, storage costs, GDPR implications.
**Instead:** Keep conversations in-memory (React state). Let them disappear on page refresh. Add explicit "save conversation" later if needed.

### Anti-Pattern 5: Multi-Agent Orchestration
**What:** Building a system of specialized agents that talk to each other.
**Why bad:** Massive over-engineering for a business app assistant. Multiplies latency, complexity, and rate limit consumption.
**Instead:** Single agent with well-defined tools. One agent with 10 tools > 5 agents with 2 tools each.

## Scalability Considerations

| Concern | 1-5 users (MVP) | 50 users | 500+ users |
|---------|-----------------|----------|------------|
| Rate limits | Free tier sufficient | May hit Gemini 250/day limit | Must add paid tier or aggressive caching |
| Latency | Firebase cold starts (~2s first call) | Acceptable with warm functions | Consider always-warm instances |
| Cost | $0 (free tiers) | $0-5/month | $20-50/month, paid LLM tiers needed |
| Conversation state | React state (in-memory) | React state | Consider Redis for shared state |

## Sources

- https://vercel.com/blog/ai-sdk-6
- https://ai-sdk.dev/docs/introduction
- https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows/
- https://www.dailydoseofds.com/ai-agents-crash-course-part-10-with-implementation/
- https://mbrenndoerfer.com/writing/action-restrictions-and-permissions-ai-agents
