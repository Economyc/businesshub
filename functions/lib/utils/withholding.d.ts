export interface WithholdingLike {
    amount?: number;
    paidAmount?: number;
    withholdingAmount?: number;
}
/** Retención practicada sobre la factura (0 si no tiene). */
export declare function withheldOf(t: WithholdingLike): number;
/** Lo que hay que girarle al proveedor: el bruto menos la retención. */
export declare function payableOf(t: WithholdingLike): number;
export declare function statusForPayable(payable: number, paid: number): 'pending' | 'partial' | 'paid';
/**
 * Lo que falta girarle al tercero: el neto menos lo ya abonado. Prefiere el
 * denormalizado `remainingAmount` que mantiene Ecore, con fallback calculado
 * para transacciones viejas que no lo tienen.
 */
export declare function pendingOf(t: WithholdingLike & {
    remainingAmount?: number;
}): number;
//# sourceMappingURL=withholding.d.ts.map