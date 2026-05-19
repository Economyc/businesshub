import { type UsageSnapshot } from './ai-usage-stats.js';
type PayrollKind = 'colilla' | 'propinas';
export declare const analyzePayrollDocument: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    kind: PayrollKind;
    extracted: {
        identification: string;
        role: string;
        employeeName: string;
        payPeriod: string;
        totalDevengado: number;
        totalDeducciones: number;
        netoCancelado: number;
    } | {
        total: number;
        rows: {
            amount: number;
            employeeName: string;
        }[];
    };
    extractionFailed: boolean;
    provider: string;
    fallbackUsed: boolean;
    usage: UsageSnapshot | undefined;
}>, unknown>;
export {};
//# sourceMappingURL=analyze-payroll-document.d.ts.map