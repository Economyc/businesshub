export declare function sendMessage(token: string, chatId: string, text: string, replyMarkup?: {
    inline_keyboard: Array<Array<{
        text: string;
        callback_data: string;
    }>>;
}): Promise<boolean>;
export declare function sendDocument(token: string, chatId: string, buffer: Buffer, filename: string, mime: string, caption?: string): Promise<boolean>;
//# sourceMappingURL=telegram-send.d.ts.map