export declare const MESES_ES: string[];
export declare const SUBFOLDER_CONSOLIDATED = "PDFs consolidados";
export declare const SUBFOLDER_TRACKING = "Seguimiento";
export declare const SUBFOLDER_LOOSE = "Facturas y pagos sueltos";
export type DocType = 'Factura' | 'Pago' | 'Compra' | 'Factura+Pago';
export declare function sanitizeForFileName(s: string): string;
export declare function parseDate(input: string | number): Date;
export declare function extFromMime(mime: string, fallbackName: string): string;
/**
 * Deriva la ruta Año/Mes y el nombre del archivo a partir del proveedor, tipo,
 * número y fecha. Devuelve los segmentos de carpeta y el nombre final (sin ext).
 */
export declare function buildDocLocation(supplierName: string, docType: DocType, docNumber: string, date: Date): {
    year: string;
    month: string;
    baseName: string;
};
//# sourceMappingURL=doc-naming.d.ts.map