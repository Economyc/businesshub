export declare const MESES_ES: string[];
export declare function monthFolderName(monthIndex: number): string;
export declare const SUBFOLDER_CONSOLIDATED = "PDFs consolidados";
export declare const SUBFOLDER_TRACKING = "Seguimiento";
export declare const SUBFOLDER_LOOSE = "Facturas y pagos sueltos";
export declare const LOOSE_SUB_INVOICES = "Facturas";
export declare const LOOSE_SUB_PURCHASES = "Compras";
export declare const LOOSE_SUB_PAYMENTS = "Pagos";
export declare const LOOSE_SUB_TRANSFERS = "Traslados";
export type DocType = 'Factura' | 'Pago' | 'Compra' | 'Factura+Pago' | 'Traslado';
export declare function looseSubfolderFor(docType: DocType): string;
export declare function sanitizeForFileName(s: string): string;
export declare function parseDate(input: string | number): Date;
export declare function extFromMime(mime: string, fallbackName: string): string;
/**
 * Deriva la ruta Año/Mes y el nombre del archivo a partir del proveedor, tipo,
 * número y fecha. Devuelve los segmentos de carpeta y el nombre final (sin ext).
 * `month` es el nombre pelado (para filenames); `monthFolder` lleva el prefijo
 * numérico y es el que va en la ruta de carpetas.
 */
export declare function buildDocLocation(supplierName: string, docType: DocType, docNumber: string, date: Date): {
    year: string;
    month: string;
    monthFolder: string;
    baseName: string;
};
//# sourceMappingURL=doc-naming.d.ts.map