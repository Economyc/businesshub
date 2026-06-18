import { z } from 'zod';
import { type UsageSnapshot } from './ai-usage-stats.js';
declare const ExtractionSchema: z.ZodObject<{
    supplierName: z.ZodString;
    docNumber: z.ZodString;
    date: z.ZodString;
    amountRaw: z.ZodString;
    category: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: string;
    category: string;
    docNumber: string;
    supplierName: string;
    amountRaw: string;
    notes?: string | undefined;
}, {
    date: string;
    category: string;
    docNumber: string;
    supplierName: string;
    amountRaw: string;
    notes?: string | undefined;
}>;
type Extraction = z.infer<typeof ExtractionSchema>;
interface ClientExtraction extends Omit<Extraction, 'amountRaw'> {
    amount: number;
}
export declare const analyzeInvoiceDocument: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    extracted: ClientExtraction;
    supplierMatch: {
        id: string;
        name: string;
        score: number;
    } | undefined;
    customerMatch: {
        id: string;
        name: string;
        score: number;
    } | undefined;
    categoryExists: boolean;
    extractionFailed: boolean;
    provider: string;
    fallbackUsed: boolean;
    usage: UsageSnapshot | undefined;
}>, unknown>;
export {};
//# sourceMappingURL=analyze-invoice-document.d.ts.map