/** Una línea con diferencia (faltante/sobrante). */
export interface CountDiffLine {
    name: string;
    unit: string;
    expected: number;
    counted: number;
    diff: number;
    diffValue: number | null;
}
/** Una línea del inventario completo (todas las activas, con o sin diferencia). */
export interface CountAllLine {
    name: string;
    unit: string;
    category: string;
    expected: number;
    counted: number;
    diff: number;
    diffValue: number | null;
}
export interface CountTotals {
    shortageValue: number;
    overageValue: number;
    netValue: number;
    itemsWithDiff: number;
}
export interface CountReportData {
    companyName?: string;
    countDate: string;
    approvedBy: string;
    /** Solo las líneas con diferencia. */
    lines: CountDiffLine[];
    /** Inventario completo (todas las activas). */
    allLines?: CountAllLine[];
    totals: CountTotals;
}
//# sourceMappingURL=count-report-types.d.ts.map