import { Bot, Context } from 'grammy';
/** Context flavor: el middleware de auth adjunta el uid vinculado. */
type BotContext = Context & {
    state: {
        uid: string;
    };
};
export interface BotConfig {
    token: string;
    geminiKey: string;
    groqKey: string;
    cerebrasKey: string;
}
export declare function createTelegramBot(cfg: BotConfig): Bot<BotContext>;
export {};
//# sourceMappingURL=bot.d.ts.map