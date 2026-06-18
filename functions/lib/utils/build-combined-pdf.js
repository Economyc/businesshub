import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
// Fusiona varias partes (facturas/comprobantes que pueden ser PDF o imagen) en
// un solo PDF. pdf-lib solo embebe JPG/PNG nativamente; WebP/HEIC/HEIF se
// normalizan a JPEG con sharp (que además corrige la orientación EXIF de fotos
// de celular).
// Tamaño A4 en puntos (72 dpi) y margen para encajar imágenes.
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 24;
// Formatea un monto como pesos colombianos con separador de miles por punto,
// sin depender de Intl/ICU (que puede variar en el runtime de Functions).
function fmtCop(n) {
    const s = Math.round(Math.abs(n))
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${n < 0 ? '-$' : '$'}${s}`;
}
// Dibuja texto alineado a la derecha de xRight.
function drawRight(page, text, xRight, y, font, size, color = rgb(0.1, 0.1, 0.12)) {
    page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color });
}
// Construye la página-carátula: encabezado + tabla de abonos (Fecha, Monto,
// % acumulado, Saldo) que va cuadrando hasta el total de la factura.
async function addCoverPage(out, cover) {
    const font = await out.embedFont(StandardFonts.Helvetica);
    const bold = await out.embedFont(StandardFonts.HelveticaBold);
    const page = out.addPage([A4_WIDTH, A4_HEIGHT]);
    const total = cover.invoiceTotal && cover.invoiceTotal > 0
        ? cover.invoiceTotal
        : cover.payments.reduce((s, p) => s + p.amount, 0);
    const ink = rgb(0.1, 0.1, 0.12);
    const muted = rgb(0.42, 0.45, 0.5);
    const left = 48;
    const right = A4_WIDTH - 48;
    let y = A4_HEIGHT - 72;
    page.drawText('Resumen de pagos', { x: left, y, size: 22, font: bold, color: ink });
    y -= 26;
    page.drawText(`${cover.docType} ${cover.docNumber} — ${cover.supplierName}`, {
        x: left,
        y,
        size: 12,
        font,
        color: muted,
    });
    y -= 34;
    // Cabecera de tabla. Columnas: Fecha (izq), Monto / % acum. / Saldo (der).
    const colMonto = 320;
    const colPct = 430;
    const colSaldo = right;
    page.drawText('Fecha', { x: left, y, size: 10, font: bold, color: muted });
    drawRight(page, 'Monto', colMonto, y, bold, 10, muted);
    drawRight(page, '% acumulado', colPct, y, bold, 10, muted);
    drawRight(page, 'Saldo', colSaldo, y, bold, 10, muted);
    y -= 8;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.75, color: rgb(0.82, 0.84, 0.87) });
    y -= 18;
    let running = 0;
    for (const p of cover.payments) {
        running += p.amount;
        const pct = total > 0 ? (running / total) * 100 : 0;
        const balance = total - running;
        page.drawText(p.date, { x: left, y, size: 11, font, color: ink });
        drawRight(page, fmtCop(p.amount), colMonto, y, font, 11);
        drawRight(page, `${pct.toFixed(1)}%`, colPct, y, font, 11);
        drawRight(page, fmtCop(balance), colSaldo, y, font, 11);
        y -= 20;
        if (y < 96)
            break; // protección: una sola página de carátula
    }
    // Totales al pie.
    y -= 4;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.75, color: rgb(0.82, 0.84, 0.87) });
    y -= 20;
    const totalPaid = cover.payments.reduce((s, p) => s + p.amount, 0);
    page.drawText('Total factura', { x: left, y, size: 11, font: bold, color: ink });
    drawRight(page, fmtCop(total), colSaldo, y, bold, 11);
    y -= 18;
    page.drawText('Total abonado', { x: left, y, size: 11, font, color: ink });
    drawRight(page, fmtCop(totalPaid), colSaldo, y, font, 11);
    y -= 18;
    page.drawText('Saldo pendiente', { x: left, y, size: 11, font, color: ink });
    drawRight(page, fmtCop(total - totalPaid), colSaldo, y, font, 11);
}
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
 * comprobantes después). Si se pasa `cover` con abonos, antepone una
 * página-carátula que resume cada abono (fecha, monto, % acumulado, saldo).
 * Si una imagen no se puede procesar, se omite esa parte en lugar de fallar
 * todo (mejor un PDF parcial que ninguno).
 */
export async function buildCombinedPdf(parts, cover) {
    const out = await PDFDocument.create();
    if (cover && cover.payments.length > 0) {
        await addCoverPage(out, cover);
    }
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