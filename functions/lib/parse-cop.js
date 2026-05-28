// Parseo de montos colombianos. Espejo de parseAmountCO en
// src/modules/finance/bank-service.ts — functions es un proyecto TS aparte y
// no puede importar de src/. El LLM transcribe el monto literal del documento
// (ej. "10.200,40" / "$1.197.773,00") y aquí lo convertimos a número de forma
// determinista, en vez de pedirle al modelo que haga la conversión de
// separadores (que se equivoca con el formato CO).
/**
 * Convierte un monto a número. Tolera formato Colombia ("1.234.567,89",
 * "$ 1.234.567"), formato US ("1,234,567.89"), negativos con signo o entre
 * paréntesis, y valores que ya son `number`. Devuelve `NaN` si no hay dígitos.
 */
export function parseAmountCO(raw) {
    if (typeof raw === 'number')
        return raw;
    let s = String(raw ?? '').trim();
    if (!s)
        return NaN;
    const negative = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /^\s*-/.test(s);
    // Quitar todo menos dígitos y separadores.
    s = s.replace(/[^\d.,]/g, '');
    if (!s)
        return NaN;
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    let normalized;
    if (lastDot !== -1 && lastComma !== -1) {
        // Ambos presentes: el separador más a la derecha es el decimal.
        const decSep = lastDot > lastComma ? '.' : ',';
        const thouSep = decSep === '.' ? ',' : '.';
        normalized = s.split(thouSep).join('').replace(decSep, '.');
    }
    else if (lastComma !== -1) {
        // Solo coma: en CO la coma es decimal salvo que sea separador de miles
        // (grupos de exactamente 3 dígitos). "1,234,567" → miles; "1234,56" → dec.
        const parts = s.split(',');
        const allThousandGroups = parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0].length <= 3;
        normalized = allThousandGroups ? parts.join('') : s.replace(',', '.');
    }
    else if (lastDot !== -1) {
        // Solo punto: en CO suele ser separador de miles. Lo tratamos como miles
        // salvo que el último grupo NO tenga 3 dígitos (entonces es decimal).
        const parts = s.split('.');
        const looksThousand = parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0].length <= 3;
        normalized = looksThousand ? parts.join('') : s;
    }
    else {
        normalized = s;
    }
    const n = Number(normalized);
    if (Number.isNaN(n))
        return NaN;
    return negative ? -Math.abs(n) : n;
}
/**
 * Monto de documento → entero de pesos. 0 si no es legible. La app trata los
 * pesos como enteros (currency-input descarta decimales, formatCurrency usa
 * decimals=0), por eso redondeamos y no permitimos negativos.
 */
export function parseCopAmount(raw) {
    const n = parseAmountCO(raw);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
//# sourceMappingURL=parse-cop.js.map