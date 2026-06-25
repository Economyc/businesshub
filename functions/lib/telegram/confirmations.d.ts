export type PendingStatus = 'pending' | 'executing' | 'done' | 'cancelled' | 'expired';
export interface PendingMutation {
    chatId: number;
    uid: string;
    companyId: string;
    toolName: string;
    toolCallId: string;
    args: Record<string, unknown>;
    telegramFileId: string | null;
    telegramFileMime: string | null;
    telegramFileName: string | null;
    status: PendingStatus;
    telegramMessageId?: number;
    origin?: 'llm' | 'ui';
}
export declare function savePendingMutation(data: Omit<PendingMutation, 'status'>): Promise<string>;
export declare function setPendingMessageId(id: string, messageId: number): Promise<void>;
export type ClaimResult = {
    ok: true;
    mutation: PendingMutation;
} | {
    ok: false;
    reason: 'not_found' | 'already_processed';
};
/** Reclama la mutación (pending → executing) de forma transaccional. */
export declare function claimPendingMutation(id: string): Promise<ClaimResult>;
export declare function finalizePendingMutation(id: string, status: Extract<PendingStatus, 'done' | 'cancelled'>, resultId?: string): Promise<void>;
export declare function markPendingCancelled(id: string): Promise<void>;
export declare function buildConfirmationText(toolName: string, args: Record<string, unknown>, companyLabel: string, hasFile: boolean): string;
//# sourceMappingURL=confirmations.d.ts.map