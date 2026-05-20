export type RegenerateResult = {
    driveFileId: string;
    webViewLink: string;
    fileName: string;
} | {
    skipped: true;
    reason: string;
};
export declare function regenerateInvoiceSheet(companyId: string, year: number, monthIndex: number): Promise<RegenerateResult>;
//# sourceMappingURL=regenerate.d.ts.map