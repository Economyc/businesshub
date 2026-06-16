// Formateo de montos y cantidades para reportes (Telegram, PDF, CSV).
// Estilo colombiano: separador de miles con punto.

/** Formatea un monto COP con separador de miles colombiano: 1234567 → $1.234.567. */
export function fmtMoney(n: number): string {
  const rounded = Math.round(n)
  const sign = rounded < 0 ? '-' : ''
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}$${grouped}`
}

/** Cantidad con hasta 1 decimal, sin ceros sobrantes. */
export function fmtQty(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? r.toString() : r.toFixed(1)
}
