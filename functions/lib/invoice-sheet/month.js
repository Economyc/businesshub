// Helpers de mes en hora Bogotá (UTC-5 fijo, sin DST). Compartidos por el
// trigger (markSheetJobDirty), el dispatch y regenerateInvoiceSheet, para que
// todos anclen las transacciones al mismo mes natural — el mismo que ve el
// cliente, que filtra con hora local del navegador (America/Bogota).
export function bogotaParts(d) {
    const b = new Date(d.getTime() - 5 * 3600 * 1000);
    return { year: b.getUTCFullYear(), monthIndex: b.getUTCMonth() };
}
// 'YYYY-MM' (monthIndex 0-based → 01-12)
export function ymKey(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
export function ymKeyFromTs(ts) {
    const d = ts?.toDate?.();
    if (!d)
        return null;
    const p = bogotaParts(d);
    return ymKey(p.year, p.monthIndex);
}
export function currentYm() {
    const p = bogotaParts(new Date());
    return { year: p.year, monthIndex: p.monthIndex, key: ymKey(p.year, p.monthIndex) };
}
export function inMonthBogota(ts, year, monthIndex) {
    const d = ts?.toDate?.();
    if (!d)
        return false;
    const p = bogotaParts(d);
    return p.year === year && p.monthIndex === monthIndex;
}
export function isCurrentMonthBogota(year, monthIndex) {
    const p = bogotaParts(new Date());
    return p.year === year && p.monthIndex === monthIndex;
}
//# sourceMappingURL=month.js.map