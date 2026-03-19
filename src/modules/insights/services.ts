// Insights module is read-only — it aggregates data from other collections.
// No CRUD operations are defined here.

export const MONTH_LABELS: Record<number, string> = {
  0: 'Ene',
  1: 'Feb',
  2: 'Mar',
  3: 'Abr',
  4: 'May',
  5: 'Jun',
  6: 'Jul',
  7: 'Ago',
  8: 'Sep',
  9: 'Oct',
  10: 'Nov',
  11: 'Dic',
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US')}`
}
