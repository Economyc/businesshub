import type { CoreMessage } from 'ai';
export declare function loadHistory(chatId: number): Promise<CoreMessage[]>;
export declare function saveHistory(chatId: number, messages: CoreMessage[]): Promise<void>;
export declare function clearHistory(chatId: number): Promise<void>;
export interface TelegramChatState {
    uid?: string;
    activeCompanyId?: string;
    activeCompanyName?: string;
    latestAttachment?: {
        fileId: string;
        mimeType: string;
        fileName: string;
    } | null;
    pendingMutationId?: string | null;
    awaitingQuickEntry?: string | null;
}
export declare function chatRef(chatId: number): FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>;
export declare function loadChatState(chatId: number): Promise<TelegramChatState>;
export declare function updateChatState(chatId: number, patch: Record<string, unknown>): Promise<void>;
//# sourceMappingURL=history.d.ts.map