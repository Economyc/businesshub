export interface ProvisionVenta {
    total?: string | number;
    impuestos?: string | number;
    tipo_documento?: string;
    estado_txt?: string;
    lista_propinas?: Array<{
        montoConIgv?: string | number;
    }>;
    pagosList?: Array<Record<string, unknown>>;
    [key: string]: unknown;
}
export interface ProvisionTotals {
    count: number;
    propinas: number;
    impoconsumo: number;
    retefuente: number;
}
export declare const AUTORRETENCION_RATE = 0.035;
export declare function isVoided(v: ProvisionVenta): boolean;
export declare function sumPropinas(v: ProvisionVenta): number;
/** Totales de provisión de una lista de ventas. Ignora las anuladas. */
export declare function calcProvisions(ventas: ProvisionVenta[]): ProvisionTotals;
export declare function addProvisions(a: ProvisionTotals, b: ProvisionTotals): ProvisionTotals;
export declare const EMPTY_PROVISIONS: ProvisionTotals;
//# sourceMappingURL=provision-totals.d.ts.map