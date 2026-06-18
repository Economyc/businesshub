export interface PdfPart {
    buffer: Buffer;
    mimeType: string;
}
export interface CoverPayment {
    date: string;
    amount: number;
}
export interface CoverInfo {
    supplierName: string;
    docType: string;
    docNumber: string;
    invoiceTotal?: number;
    payments: CoverPayment[];
}
/**
 * Construye un PDF combinado con las partes en el orden dado (factura primero,
 * comprobantes después). Si se pasa `cover` con abonos, antepone una
 * página-carátula que resume cada abono (fecha, monto, % acumulado, saldo).
 * Si una imagen no se puede procesar, se omite esa parte en lugar de fallar
 * todo (mejor un PDF parcial que ninguno).
 */
export declare function buildCombinedPdf(parts: PdfPart[], cover?: CoverInfo): Promise<Buffer>;
//# sourceMappingURL=build-combined-pdf.d.ts.map