import type { Context } from 'grammy';
import type { CallbackRouter, CallbackDeps } from './callbacks.js';
import { type CallbackState } from './callback-state.js';
type BotCtx = Context & {
    state: {
        uid: string;
    };
};
type EntryKind = 'expense' | 'invoice';
export interface QuickEntryPayload {
    kind: EntryKind;
    suppliers: Array<{
        id: string;
        name: string;
    }>;
    supplierName?: string | null;
    date?: string;
}
/** Entrada del flujo (comando /registrar o botón ➕). Envía mensaje nuevo. */
export declare function startQuickEntry(ctx: BotCtx, chatId: number): Promise<void>;
/** Instrucción para el LLM con los campos bloqueados del registro rápido. */
export declare function quickEntryInstructions(payload: QuickEntryPayload): string;
export declare function loadQuickEntryState(stateId: string, chatId: number): Promise<CallbackState<QuickEntryPayload> | null>;
export declare function registerQuickEntry(router: CallbackRouter): void;
/** Continuación tras elegir fecha: pide monto + concepto por texto. */
export declare function continueQuickEntryAfterDate(ctx: BotCtx, deps: CallbackDeps, state: CallbackState<QuickEntryPayload>, dateIso: string): Promise<void>;
export {};
//# sourceMappingURL=quick-entry.d.ts.map