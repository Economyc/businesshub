import { InlineKeyboard } from 'grammy';
import type { CallbackRouter } from './callbacks.js';
/** Construye el texto + teclado del selector (la activa marcada con ▶️). */
export declare function buildCompanySelector(uid: string, chatId: number): Promise<{
    text: string;
    keyboard: InlineKeyboard;
} | null>;
export declare function registerCompanySelect(router: CallbackRouter): void;
//# sourceMappingURL=company-select.d.ts.map