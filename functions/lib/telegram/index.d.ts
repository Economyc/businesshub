export declare const telegramBotToken: import("firebase-functions/params").SecretParam;
export declare const telegramWebhookSecret: import("firebase-functions/params").SecretParam;
export declare const telegramBot: import("firebase-functions/v2/https").HttpsFunction;
export declare const telegramLinkStart: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    url: string;
    expiresInMinutes: number;
}>, unknown>;
//# sourceMappingURL=index.d.ts.map