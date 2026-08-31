import { z } from 'zod';
import { type UsageSnapshot } from './ai-usage-stats.js';
declare const ExtractionSchema: z.ZodObject<{
    supplierName: z.ZodString;
    amountRaw: z.ZodString;
    date: z.ZodString;
    referenceNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: string;
    supplierName: string;
    amountRaw: string;
    referenceNumber?: string | undefined;
}, {
    date: string;
    supplierName: string;
    amountRaw: string;
    referenceNumber?: string | undefined;
}>;
type Extraction = z.infer<typeof ExtractionSchema>;
interface ClientExtraction extends Omit<Extraction, 'amountRaw'> {
    amount: number;
}
export declare const analyzePaymentReceipt: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    extracted: ClientExtraction;
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
    extractionFailed: boolean;
    failureReason: string | undefined;
    failureCode: "providers" | "timeout" | undefined;
    provider: string;
    fallbackUsed: boolean;
    usage: UsageSnapshot | undefined;
}>, unknown>;
export {};
//# sourceMappingURL=analyze-payment-receipt.d.ts.map