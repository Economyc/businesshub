import { type ToolSet } from 'ai';
import { type CompanyInfo } from './resolve-payee.js';
export declare function createTelegramTools(opts: {
    activeCompanyId: string;
    companies: CompanyInfo[];
    chatId: number;
}): ToolSet;
/** Tools de escritura: requieren confirmación y ejecutan en mutations.ts. */
export declare const WRITE_TOOL_NAMES: Set<string>;
/** Tools de escritura que necesitan el archivo adjunto del usuario. */
export declare const FILE_TOOL_NAMES: Set<string>;
//# sourceMappingURL=tools.d.ts.map