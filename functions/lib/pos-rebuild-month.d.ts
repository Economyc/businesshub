export interface RebuildMonthResult {
    month: string;
    companyId: string;
    localIds: number[];
    salesDocsDeleted: number;
    ventasFetched: number;
    ventasWritten: number;
    daysWritten: number;
    windowsProcessed: number;
    rateLimited: boolean;
    durationMs: number;
    error?: string;
}
interface RebuildData {
    companyId?: string;
    month?: string;
}
export declare const posRebuildMonth: import("firebase-functions/v2/https").CallableFunction<RebuildData, any, unknown>;
export {};
//# sourceMappingURL=pos-rebuild-month.d.ts.map