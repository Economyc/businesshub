interface RevertResult {
    deletedFiles: number;
    attemptedFiles: number;
    monthsRegenerated: {
        year: number;
        monthIndex: number;
    }[];
    sheetWarning: string | null;
    alreadyReverted: boolean;
    driveErrors: string[];
    affected: string[];
}
export declare const revertPaymentWithAttachments: import("firebase-functions/v2/https").CallableFunction<any, Promise<RevertResult>, unknown>;
export {};
//# sourceMappingURL=revert-payment.d.ts.map