/**
 * Ejecuta OCR sobre una imagen en base64 y devuelve el texto detectado.
 * Lanza si la imagen es ilegible o si la API responde con error.
 */
export declare function ocrImageBase64(fileBase64: string): Promise<string>;
/**
 * Ejecuta OCR sobre un PDF en base64 (inline, hasta las primeras 5 páginas) y
 * devuelve el texto detectado concatenado por página. Usa batchAnnotateFiles
 * porque documentTextDetection no acepta PDFs inline. Solo se invoca como
 * fallback cuando pdf-parse no extrajo texto (PDF escaneado / solo imágenes).
 * Lanza si la API responde con error.
 */
export declare function ocrPdfBase64(fileBase64: string): Promise<string>;
//# sourceMappingURL=cloud-vision-ocr.d.ts.map