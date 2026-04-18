export declare const SALES_COLLECTION = "pos-sales-cache";
export declare const META_COLLECTION = "pos-sales-cache-meta";
export declare const MAX_VENTAS_PER_DOC = 150;
export declare const PARTIAL_RESPONSE_THRESHOLD = 0.5;
export interface PosVentaLike {
    fecha?: string;
    id_local?: number | string;
    [key: string]: unknown;
}
export declare function isLikelyPartialResponse(newCount: number, prevCount: number): boolean;
export declare function enumerateDates(start: string, end: string): string[];
export declare function getTodayStrBogota(): string;
export declare function addDays(date: string, days: number): string;
export type PreviousCounts = Map<string, number>;
export declare function getPreviousCountsForRange(companyId: string, localIds: number[], startDate: string, endDate: string): Promise<PreviousCounts>;
export interface SaveStats {
    daysWritten: number;
    ventasWritten: number;
    skippedPartial: number;
    emptyStamped: number;
}
export interface SaveOptions {
    stampEmpty?: boolean;
}
export declare function saveVentasToCacheServer(companyId: string, ventas: PosVentaLike[], localIds: number[], startDate: string, endDate: string, previousCounts: PreviousCounts, options?: SaveOptions): Promise<SaveStats>;
//# sourceMappingURL=pos-cache.d.ts.map