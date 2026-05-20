import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
// Fusiona varias partes (facturas/comprobantes que pueden ser PDF o imagen) en
// un solo PDF. pdf-lib solo embebe JPG/PNG nativamente; WebP/HEIC/HEIF se
// normalizan a JPEG con sharp (que además corrige la orientación EXIF de fotos
// de celular).
// Tamaño A4 en puntos (72 dpi) y margen para encajar imágenes.
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 24;
function isPdf(mime) {
    return mime.includes('pdf');
}
function isNativeImage(mime) {
    return mime.includes('jpeg') || mime.includes('jpg') || mime.includes('png');
}
async function addImagePage(out, part) {
    let bytes = part.buffer;
    let mime = part.mimeType;
    // Normaliza todo lo que pdf-lib no embebe (webp, heic, heif, octet-stream…) a JPEG.
    if (!isNativeImage(mime)) {
        bytes = await sharp(bytes).rotate().jpeg({ quality: 85 }).toBuffer();
        mime = 'image/jpeg';
    }
    let img;
    if (mime.includes('png')) {
        img = await out.embedPng(bytes);
    }
    else {
        img = await out.embedJpg(bytes);
    }
    const page = out.addPage([A4_WIDTH, A4_HEIGHT]);
    const maxW = A4_WIDTH - MARGIN * 2;
    const maxH = A4_HEIGHT - MARGIN * 2;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, {
        x: (A4_WIDTH - w) / 2,
        y: (A4_HEIGHT - h) / 2,
        width: w,
        height: h,
    });
}
async function appendPdfPages(out, bytes) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages)
        out.addPage(p);
}
/**
 * Construye un PDF combinado con las partes en el orden dado (factura primero,
 * comprobante después). Si una imagen no se puede procesar, se omite esa parte
 * en lugar de fallar todo (mejor un PDF parcial que ninguno).
 */
export async function buildCombinedPdf(parts) {
    const out = await PDFDocument.create();
    for (const part of parts) {
        if (isPdf(part.mimeType)) {
            await appendPdfPages(out, part.buffer);
        }
        else {
            await addImagePage(out, part);
        }
    }
    if (out.getPageCount() === 0) {
        throw new Error('No se pudo agregar ninguna página al PDF combinado');
    }
    const saved = await out.save();
    return Buffer.from(saved);
}
//# sourceMappingURL=build-combined-pdf.js.map