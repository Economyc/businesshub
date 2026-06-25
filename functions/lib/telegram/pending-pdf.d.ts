import type { Context } from 'grammy';
import type { CallbackRouter, CallbackDeps } from './callbacks.js';
type BotCtx = Context & {
    state: {
        uid: string;
    };
};
export declare function sendPendingPaymentsPdf(ctx: BotCtx, deps: CallbackDeps): Promise<void>;
export declare function registerPendingPdf(router: CallbackRouter): void;
export {};
//# sourceMappingURL=pending-pdf.d.ts.map