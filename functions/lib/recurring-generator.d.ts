/**
 * Genera transacciones pendientes a partir de recurrentes activas.
 * Versión server-side usando Admin SDK.
 */
export declare function generatePendingTransactionsServer(companyId: string): Promise<number>;
/**
 * Cuenta cuántas transacciones recurrentes se generarían (dry-run).
 * Útil para previews sin escribir datos.
 */
export declare function countPendingRecurring(companyId: string): Promise<number>;
//# sourceMappingURL=recurring-generator.d.ts.map