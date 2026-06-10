import { type CompanyInfo } from './resolve-payee.js';
export interface MutationResult {
    success: boolean;
    message: string;
    id?: string;
}
export interface MutationAttachment {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
}
export declare function executeServerMutation(opts: {
    uid: string;
    defaultCompanyId: string;
    toolName: string;
    args: Record<string, unknown>;
    companies: CompanyInfo[];
    attachment?: MutationAttachment | null;
}): Promise<MutationResult>;
//# sourceMappingURL=mutations.d.ts.map