export declare const DEFAULT_RECONCILE_DAYS = 32;
export interface ReconcileStats {
    companyId: string;
    localIds: number[];
    ventasFetched: number;
    ventasWritten: number;
    daysWritten: number;
    skippedPartial: number;
    emptyStamped: number;
    rateLimited: boolean;
    durationMs: number;
    error?: string;
}
export interface ReconcileResult {
    startDate: string;
    endDate: string;
    companiesProcessed: number;
    ventasWritten: number;
    totalDurationMs: number;
    perCompany: ReconcileStats[];
}
export declare const posReconcileNightly: import("firebase-functions/v2/scheduler").ScheduleFunction;
interface OnDemandData {
    companyId?: string;
    days?: number;
}
export declare const posReconcileOnDemand: import("firebase-functions/v2/https").CallableFunction<OnDemandData, any, unknown>;
export {};
//# sourceMappingURL=pos-reconcile.d.ts.map