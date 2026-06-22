// Genera el PDF consolidado de "pagos pendientes por compañía" con pdf-lib
// (dibujo manual de tablas, mismo enfoque que build-count-diff-pdf.ts). Una sección
// por compañía con dos bloques: (A) facturas por pagar agrupadas por proveedor y
// (B) otras obligaciones pendientes. Cierra con el gran total. Devuelve un Buffer.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fmtMoney } from './format-money.js';
const PAGE = { w: 595.28, h: 841.89 }; // A4 vertical
const MARGIN = 40;
const CONTENT_W = PAGE.w - MARGIN * 2;
const ROW_H = 16;
const PAD = 5;
const GRAPHITE = rgb(0.16, 0.18, 0.2);
const MID = rgb(0.45, 0.47, 0.5);
const LINE = rgb(0.9, 0.9, 0.92);
const HEADER_FILL = rgb(0.22, 0.25, 0.28);
const NEGATIVE = rgb(0.7, 0.18, 0.18);
const WHITE = rgb(1, 1, 1);
const INVOICE_COLS = [
    { header: 'Proveedor', width: 175, align: 'left' },
    { header: '# Fact.', width: 50, align: 'right' },
    { header: 'Total', width: 100, align: 'right' },
    { header: 'Más antigua', width: 90, align: 'left' },
    { header: 'Vencidas', width: 100, align: 'right' },
];
const OBLIGATION_COLS = [
    { header: 'Concepto', width: 250, align: 'left' },
    { header: 'Vence', width: 95, align: 'left' },
    { header: 'Monto', width: 100, align: 'right' },
    { header: 'Estado', width: 70, align: 'left' },
];
function clip(text, font, size, maxW) {
    if (font.widthOfTextAtSize(text, size) <= maxW)
        return text;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxW)
        t = t.slice(0, -1);
    return `${t}…`;
}
function addPage(d) {
    d.page = d.pdf.addPage([PAGE.w, PAGE.h]);
    d.y = PAGE.h - MARGIN;
}
function ensureSpace(d, needed) {
    if (d.y - needed < MARGIN)
        addPage(d);
}
function drawTableHeader(d, cols) {
    ensureSpace(d, ROW_H);
    d.page.drawRectangle({ x: MARGIN, y: d.y - ROW_H, width: CONTENT_W, height: ROW_H, color: HEADER_FILL });
    let x = MARGIN;
    for (const c of cols) {
        const w = d.bold.widthOfTextAtSize(c.header, 8);
        const tx = c.align === 'right' ? x + c.width - PAD - w : x + PAD;
        d.page.drawText(c.header, { x: tx, y: d.y - ROW_H + 5, size: 8, font: d.bold, color: WHITE });
        x += c.width;
    }
    d.y -= ROW_H;
}
function drawRow(d, cols, cells, color = GRAPHITE) {
    // Si no cabe la fila, nueva página + re-dibuja el encabezado de columnas.
    if (d.y - ROW_H < MARGIN) {
        addPage(d);
        drawTableHeader(d, cols);
    }
    let x = MARGIN;
    cols.forEach((c, i) => {
        const raw = cells[i] ?? '';
        const text = clip(raw, d.font, 8, c.width - PAD * 2);
        const w = d.font.widthOfTextAtSize(text, 8);
        const tx = c.align === 'right' ? x + c.width - PAD - w : x + PAD;
        d.page.drawText(text, { x: tx, y: d.y - ROW_H + 5, size: 8, font: d.font, color });
        x += c.width;
    });
    d.page.drawLine({
        start: { x: MARGIN, y: d.y - ROW_H },
        end: { x: MARGIN + CONTENT_W, y: d.y - ROW_H },
        thickness: 0.5,
        color: LINE,
    });
    d.y -= ROW_H;
}
function sectionTitle(d, title, size = 11) {
    ensureSpace(d, ROW_H + 8);
    d.y -= 8;
    d.page.drawText(title, { x: MARGIN, y: d.y - size, size, font: d.bold, color: GRAPHITE });
    d.y -= ROW_H;
}
function subTitle(d, title) {
    ensureSpace(d, ROW_H);
    d.page.drawText(title, { x: MARGIN, y: d.y - 9, size: 9, font: d.bold, color: MID });
    d.y -= ROW_H;
}
function emptyNote(d, text) {
    ensureSpace(d, ROW_H);
    d.page.drawText(text, { x: MARGIN, y: d.y - 9, size: 9, font: d.font, color: MID });
    d.y -= ROW_H;
}
function statusLabel(status) {
    if (status === 'overdue')
        return 'Vencida';
    if (status === 'partial')
        return 'Parcial';
    return 'Pendiente';
}
function drawCompany(d, c) {
    sectionTitle(d, c.companyName, 13);
    // Bloque A — Facturas por pagar.
    subTitle(d, `Facturas por pagar — ${c.invoiceCount} (${fmtMoney(c.invoiceTotal)})`);
    if (c.invoiceSuppliers.length === 0) {
        emptyNote(d, 'Sin facturas pendientes.');
    }
    else {
        drawTableHeader(d, INVOICE_COLS);
        for (const s of c.invoiceSuppliers) {
            const overdue = s.overdueCount > 0 ? `${s.overdueCount}` : '—';
            drawRow(d, INVOICE_COLS, [s.supplierName, String(s.count), fmtMoney(s.total), s.oldestDate ?? '—', overdue], s.overdueCount > 0 ? NEGATIVE : GRAPHITE);
        }
    }
    // Bloque B — Otras obligaciones.
    subTitle(d, `Otras obligaciones — ${c.obligationCount} (${fmtMoney(c.obligationTotal)})`);
    if (c.obligations.length === 0) {
        emptyNote(d, 'Sin otras obligaciones pendientes.');
    }
    else {
        drawTableHeader(d, OBLIGATION_COLS);
        for (const o of c.obligations) {
            drawRow(d, OBLIGATION_COLS, [o.concept || '—', o.dueDate ?? '—', fmtMoney(o.amount), statusLabel(o.status)], o.status === 'overdue' ? NEGATIVE : GRAPHITE);
        }
    }
    // Total de la compañía.
    ensureSpace(d, ROW_H + 4);
    d.y -= 4;
    const totalLabel = `Total ${c.companyName}: ${fmtMoney(c.companyTotal)}`;
    const w = d.bold.widthOfTextAtSize(totalLabel, 10);
    d.page.drawText(totalLabel, { x: MARGIN + CONTENT_W - w, y: d.y - 11, size: 10, font: d.bold, color: GRAPHITE });
    d.y -= ROW_H;
}
export async function buildPendingPaymentsPdf(report) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const d = { pdf, page: pdf.addPage([PAGE.w, PAGE.h]), y: PAGE.h - MARGIN, font, bold };
    // Encabezado del documento.
    d.page.drawText('Pagos pendientes', { x: MARGIN, y: d.y - 16, size: 16, font: bold, color: GRAPHITE });
    d.y -= 16 + 6;
    d.page.drawText(`Reporte del ${report.dateLabel}`, { x: MARGIN, y: d.y - 10, size: 9, font, color: MID });
    d.y -= 10 + 8;
    // Recuadro con el gran total.
    const boxH = 44;
    d.page.drawRectangle({ x: MARGIN, y: d.y - boxH, width: CONTENT_W, height: boxH, borderColor: LINE, borderWidth: 1 });
    d.page.drawText('TOTAL POR PAGAR (todas las compañías)', { x: MARGIN + 10, y: d.y - 16, size: 7, font: bold, color: MID });
    d.page.drawText(fmtMoney(report.grandTotal), { x: MARGIN + 10, y: d.y - 34, size: 15, font: bold, color: NEGATIVE });
    d.y -= boxH + 6;
    for (const c of report.companies)
        drawCompany(d, c);
    const bytes = await pdf.save();
    return Buffer.from(bytes);
}
//# sourceMappingURL=build-pending-payments-pdf.js.map