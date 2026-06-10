import type { CompanyInfo } from './resolve-payee.js';
export interface TelegramLink {
    uid: string;
    username?: string;
}
export declare function resolveLink(chatId: number): Promise<TelegramLink | null>;
/** Genera un token de un solo uso para el deep link t.me/<bot>?start=TOKEN. */
export declare function createLinkToken(uid: string): Promise<string>;
export type ConsumeResult = {
    ok: true;
    uid: string;
} | {
    ok: false;
    reason: 'invalid' | 'expired' | 'used';
};
export declare function consumeLinkToken(token: string, chatId: number, username?: string): Promise<ConsumeResult>;
/**
 * Companies donde el uid es miembro activo. Mismo criterio que
 * utils/company-access.ts (members/{uid}.status === 'active').
 */
export declare function loadUserCompanies(uid: string): Promise<CompanyInfo[]>;
//# sourceMappingURL=auth.d.ts.map