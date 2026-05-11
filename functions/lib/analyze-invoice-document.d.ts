export declare const analyzeInvoiceDocument: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    extracted: {
        date: string;
        category: string;
        amount: number;
        docNumber: string;
        supplierName: string;
        notes?: string | undefined;
    };
    supplierMatch: {
        id: string;
        name: string;
        score: number;
    } | undefined;
    categoryExists: boolean;
}>, unknown>;
//# sourceMappingURL=analyze-invoice-document.d.ts.map