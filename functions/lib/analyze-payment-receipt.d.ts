export declare const analyzePaymentReceipt: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    extracted: {
        date: string;
        amount: number;
        supplierName: string;
        referenceNumber?: string | undefined;
    };
    suggestion: {
        invoiceId: string;
        docNumber: string;
        supplierName: string;
        amount: number;
        date: string | null;
        confidence: "high" | "medium" | "low";
        amountDeltaPct: number;
    } | undefined;
    candidates: {
        invoiceId: string;
        docNumber: string;
        supplierName: string;
        amount: number;
        date: string | null;
    }[];
}>, unknown>;
//# sourceMappingURL=analyze-payment-receipt.d.ts.map