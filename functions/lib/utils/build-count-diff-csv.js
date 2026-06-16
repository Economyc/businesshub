// Genera el CSV del inventario completo del conteo. Separador ';' (Excel es-CO),
// salto CRLF y BOM UTF-8 para que las tildes se vean bien al abrir en Excel.
// Números crudos (con coma decimal es-CO) para que Excel los sume.
const BOM = '﻿';
const SEP = ';';
const EOL = '\r\n';
/** Escapa un campo CSV: lo entrecomilla si tiene separador, comillas o salto. */
function csvField(value) {
    const s = String(value ?? '');
    if (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}
/** Número con coma decimal es-CO, hasta 2 decimales sin ceros sobrantes. */
function numEs(n) {
    const r = Math.round(n * 100) / 100;
    return r.toString().replace('.', ',');
}
export function buildCountDiffCsv(data) {
    const headers = ['Insumo', 'Categoría', 'Unidad', 'Esperado', 'Contado', 'Diferencia', 'Valor'];
    const rows = (data.allLines ?? []).map((l) => [
        l.name,
        l.category || '',
        l.unit,
        numEs(l.expected),
        numEs(l.counted),
        numEs(l.diff),
        l.diffValue != null ? numEs(l.diffValue) : '',
    ]
        .map(csvField)
        .join(SEP));
    const csv = [headers.map(csvField).join(SEP), ...rows].join(EOL) + EOL;
    return Buffer.from(BOM + csv, 'utf8');
}
//# sourceMappingURL=build-count-diff-csv.js.map