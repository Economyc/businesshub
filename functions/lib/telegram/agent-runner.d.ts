import { type CoreMessage, type ToolSet } from 'ai';
import { type CompanyContext, type UserAgentMemory } from '../system-prompt.js';
export interface PendingToolCall {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
}
export interface AgentTurnResult {
    text: string;
    /** Mensajes assistant/tool generados por el SDK durante el turno. */
    responseMessages: CoreMessage[];
    /** Tool-calls de escritura (tools sin execute) que esperan confirmación. */
    pendingToolCalls: PendingToolCall[];
}
export declare class AllProvidersBusyError extends Error {
    constructor();
}
export declare function runAgentTurn(opts: {
    messages: CoreMessage[];
    companies: CompanyContext[];
    activeCompanyId: string;
    userMemory: UserAgentMemory | null;
    tools: ToolSet;
    geminiKey: string;
    groqKey: string;
    cerebrasKey: string;
    userId: string;
    chatId: number;
    needsPdfNative?: boolean;
}): Promise<AgentTurnResult>;
//# sourceMappingURL=agent-runner.d.ts.map