import { InlineKeyboard } from 'grammy';
export declare function buildMainMenu(): InlineKeyboard;
export declare const MAIN_MENU_TEXT: string;
export declare function backToMenuKeyboard(extra?: InlineKeyboard): InlineKeyboard;
/** "Hoy" en calendario de Bogotá, como YYYY-MM-DD. */
export declare function bogotaTodayIso(): string;
/** Suma días a un ISO YYYY-MM-DD (mediodía UTC evita bordes de DST). */
export declare function isoAddDays(iso: string, delta: number): string;
/** Etiqueta legible de una fecha ISO, ej. "21 jun 2026". */
export declare function isoLabel(iso: string): string;
export declare const DATE_PICKER_TEXT = "\uD83D\uDCC5 \u00BFQu\u00E9 fecha?";
/**
 * Teclado de selección de fecha para un flujo (stateId). Fila rápida
 * Hoy/Ayer/Antier + mini-calendario del mes (y, m con m = 1..12) con navegación.
 * callbacks: dp:set:<stateId>:<YYYY-MM-DD> y dp:nav:<stateId>:<YYYY-MM>.
 */
export declare function buildDatePicker(stateId: string, year?: number, month?: number): InlineKeyboard;
/** Recorta un texto para que entre en una etiqueta de botón. */
export declare function clampLabel(s: string, max?: number): string;
/** "Proveedor — $monto" para botones de factura. */
export declare function invoiceButtonLabel(supplierName: string | null, amount: number): string;
//# sourceMappingURL=menus.d.ts.map