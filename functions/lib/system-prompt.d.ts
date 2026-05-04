export interface CompanyContext {
    id: string;
    name: string;
    location?: string | null;
    slug?: string | null;
}
export declare function getAgentSystemPrompt(opts?: {
    companies?: CompanyContext[];
    activeCompanyId?: string;
}): string;
//# sourceMappingURL=system-prompt.d.ts.map