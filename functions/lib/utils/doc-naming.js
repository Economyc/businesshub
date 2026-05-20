// Helpers compartidos para nombrar y ubicar documentos en Drive.
// Usados por uploadDocumentToDrive y combineInvoicePaymentToDrive: ambos
// estructuran los archivos como {root}/{YYYY}/{MesEs}/{filename} y derivan el
// nombre de proveedor + tipo + número + fecha.
export const MESES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export function sanitizeForFileName(s) {
    return s.replace(/[\\/:*?"<>|]/g, '').trim();
}
export function parseDate(input) {
    if (typeof input === 'number')
        return new Date(input);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (m)
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(input);
}
export function extFromMime(mime, fallbackName) {
    if (mime.includes('pdf'))
        return 'pdf';
    if (mime.includes('jpeg') || mime.includes('jpg'))
        return 'jpg';
    if (mime.includes('png'))
        return 'png';
    if (mime.includes('webp'))
        return 'webp';
    if (mime.includes('heic'))
        return 'heic';
    if (mime.includes('heif'))
        return 'heif';
    const idx = fallbackName.lastIndexOf('.');
    return idx >= 0 ? fallbackName.slice(idx + 1).toLowerCase() : 'bin';
}
/**
 * Deriva la ruta Año/Mes y el nombre del archivo a partir del proveedor, tipo,
 * número y fecha. Devuelve los segmentos de carpeta y el nombre final (sin ext).
 */
export function buildDocLocation(supplierName, docType, docNumber, date) {
    const year = String(date.getFullYear());
    const month = MESES_ES[date.getMonth()];
    const dd = String(date.getDate()).padStart(2, '0');
    const supplier = sanitizeForFileName(supplierName);
    const docNum = sanitizeForFileName(docNumber);
    const baseName = `${supplier} - ${docType} ${docNum} - ${month} ${dd} ${year}`;
    return { year, month, baseName };
}
//# sourceMappingURL=doc-naming.js.map