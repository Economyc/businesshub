export function formatCurrency(amount: number, decimals = 0): string {
  return `$${amount.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export function formatPercentChange(value: number | null): string {
  if (value === null) return '--'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}
