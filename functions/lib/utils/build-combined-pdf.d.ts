export interface PdfPart {
    buffer: Buffer;
    mimeType: string;
}
/**
 * Construye un PDF combinado con las partes en el orden dado (factura primero,
 * comprobante después). Si una imagen no se puede procesar, se omite esa parte
 * en lugar de fallar todo (mejor un PDF parcial que ninguno).
 */
export declare function buildCombinedPdf(parts: PdfPart[]): Promise<Buffer>;
//# sourceMappingURL=build-combined-pdf.d.ts.map