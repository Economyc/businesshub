interface MoveResult {
    newTransactionId: string | null;
    movedFiles: number;
    attemptedFiles: number;
    sheetOriginRegenerated: boolean;
    sheetTargetRegenerated: boolean;
    sheetWarning: string | null;
    alreadyMoved: boolean;
}
export declare const moveInvoiceToCompany: import("firebase-functions/v2/https").CallableFunction<any, Promise<MoveResult>, unknown>;
export {};
//# sourceMappingURL=move-transaction.d.ts.map