interface DeleteResult {
    deletedFiles: number;
    attemptedFiles: number;
    monthRegenerated: {
        year: number;
        monthIndex: number;
    } | null;
    sheetWarning: string | null;
    alreadyDeleted: boolean;
    driveErrors: string[];
}
export declare const deleteTransactionWithAttachments: import("firebase-functions/v2/https").CallableFunction<any, Promise<DeleteResult>, unknown>;
export {};
//# sourceMappingURL=delete-transaction.d.ts.map