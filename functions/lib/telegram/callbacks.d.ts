import type { Context } from 'grammy';
type BotCtx = Context & {
    state: {
        uid: string;
    };
};
/** Lo que un handler de callback necesita del bot, inyectado por dispatch. */
export interface CallbackDeps {
    cfg: {
        token: string;
        geminiKey: string;
        groqKey: string;
        cerebrasKey: string;
    };
    chatId: number;
    uid: string;
}
/** args = tokens después del namespace (data.split(':').slice(1)). */
export type CallbackHandler = (ctx: BotCtx, args: string[], deps: CallbackDeps) => Promise<void>;
export interface CallbackRouter {
    register(namespace: string, handler: CallbackHandler): void;
    /** true si algún namespace manejó el callback. */
    dispatch(ctx: BotCtx, deps: CallbackDeps): Promise<boolean>;
}
export declare function createCallbackRouter(): CallbackRouter;
export {};
//# sourceMappingURL=callbacks.d.ts.map