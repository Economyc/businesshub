import type { Context } from 'grammy';
import type { CallbackRouter, CallbackDeps } from './callbacks.js';
import { type CallbackState } from './callback-state.js';
type BotCtx = Context & {
    state: {
        uid: string;
    };
};
interface PayInvoice {
    id: string;
    concept: string;
    /** Bruto de la factura (el gasto causado). */
    amount: number;
    /** Lo que de verdad hay que girar = amount − retefuente. Es lo que se muestra. */
    payable: number;
    withheld: number;
    supplierName: string | null;
    date: string | null;
}
interface PayFlowPayload {
    invoices: PayInvoice[];
    selectedIdx?: number;
}
/** Entrada del flujo: lista las facturas pendientes. Envía un mensaje nuevo. */
export declare function openPayFlow(ctx: BotCtx, deps: CallbackDeps, requestedCompanyId?: string): Promise<void>;
/** Continuación tras elegir fecha en el selector: arma la tarjeta de confirmación. */
export declare function continuePayFlowAfterDate(ctx: BotCtx, deps: CallbackDeps, state: CallbackState<PayFlowPayload>, dateIso: string): Promise<void>;
export declare function registerPayFlow(router: CallbackRouter): void;
export {};
//# sourceMappingURL=pay-flow.d.ts.map