// Generación del .xlsx en Node (SheetJS), espejo de `buildWorkbook` de
// `src/core/utils/data-transfer.ts` pero devolviendo base64 directo (lo que
// `uploadOrReplaceFile` espera) en vez de ArrayBuffer.
//
// Diferencia con el cliente: se inserta una fila de aviso en A1 (la hoja se
// regenera sola; lo escrito a mano se pierde). Por eso headers van en la fila 2
// y los datos desde la 3.
import * as XLSX from 'xlsx';
// Aviso para la contadora: la hoja es un reporte automático.
export const SHEET_WARNING = '⚠ Hoja generada automáticamente desde BusinessHub — no editar a mano (se regenera sola y los cambios se pierden).';
// Valor de celda: número crudo cuando el campo es numérico (para que Sheets lo
// sume), si no string.
function cellValue(item, f) {
    const val = item[f.key];
    if (f.type === 'number') {
        const n = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(n) ? n : '';
    }
    return String(val ?? '');
}
export function buildWorkbookBase64(sheets) {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
        const headers = s.fields.map((f) => f.header);
        const rows = s.data.map((item) => s.fields.map((f) => cellValue(item, f)));
        // Fila 1: aviso · Fila 2: headers · Fila 3+: datos.
        const ws = XLSX.utils.aoa_to_sheet([[SHEET_WARNING], headers, ...rows]);
        ws['!cols'] = s.fields.map((f) => ({ wch: Math.max(f.header.length + 2, 14) }));
        // Combinar el aviso a lo ancho de todas las columnas.
        if (s.fields.length > 1) {
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: s.fields.length - 1 } }];
        }
        // Excel limita nombres de pestaña a 31 chars y prohíbe : \ / ? * [ ]
        const safeName = s.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Datos';
        XLSX.utils.book_append_sheet(wb, ws, safeName);
    }
    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
}
//# sourceMappingURL=build-workbook.js.map