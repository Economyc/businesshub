export declare const saveInvoiceSheetToDrive: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    driveFileId: string;
    webViewLink: string;
    fileName: string;
} | {
    queued: true;
    reason: "locked";
} | {
    queued: true;
    reason: "timeout";
}>, unknown>;
//# sourceMappingURL=save-invoice-sheet.d.ts.map