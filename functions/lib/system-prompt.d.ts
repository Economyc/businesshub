export interface CompanyContext {
    id: string;
    name: string;
    location?: string | null;
    slug?: string | null;
}
export interface UserAgentMemory {
    preferredCompanies?: string[];
    preferredFormat?: 'table' | 'prose' | 'auto';
    language?: 'es' | 'en';
    shortcuts?: Record<string, string>;
    notes?: string;
}
interface AgentThreadPromptInput {
    title: string;
    context: Record<string, unknown>;
    nextActions: string[];
}
export declare function getAgentSystemPrompt(opts?: {
    companies?: CompanyContext[];
    activeCompanyId?: string;
    userMemory?: UserAgentMemory | null;
    inlineContext?: Record<string, unknown> | null;
    thread?: AgentThreadPromptInput | null;
}): string;
export {};
//# sourceMappingURL=system-prompt.d.ts.map