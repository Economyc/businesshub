import type { FieldDef } from './accounting-rows.js';
export interface SheetSpec {
    name: string;
    data: Record<string, unknown>[];
    fields: FieldDef[];
}
export declare const SHEET_WARNING = "\u26A0 Hoja generada autom\u00E1ticamente desde BusinessHub \u2014 no editar a mano (se regenera sola y los cambios se pierden).";
export declare function buildWorkbookBase64(sheets: SheetSpec[]): string;
//# sourceMappingURL=build-workbook.d.ts.map