/**
 * Convierte un monto a número. Tolera formato Colombia ("1.234.567,89",
 * "$ 1.234.567"), formato US ("1,234,567.89"), negativos con signo o entre
 * paréntesis, y valores que ya son `number`. Devuelve `NaN` si no hay dígitos.
 */
export declare function parseAmountCO(raw: unknown): number;
/**
 * Monto de documento → entero de pesos. 0 si no es legible. La app trata los
 * pesos como enteros (currency-input descarta decimales, formatCurrency usa
 * decimals=0), por eso redondeamos y no permitimos negativos.
 */
export declare function parseCopAmount(raw: unknown): number;
//# sourceMappingURL=parse-cop.d.ts.map