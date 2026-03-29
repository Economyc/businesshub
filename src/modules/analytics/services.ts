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

import type { CostGroup } from './types'

/** Costos Operativos: gastos recurrentes del día a día del negocio */
const OPERATIVE_CATEGORIES = ['Nómina', 'Alquiler', 'Servicios', 'Suministros', 'Transporte', 'Marketing']

/** Obligaciones: gastos obligatorios legales/regulatorios */
const OBLIGATION_CATEGORIES = ['Impuestos', 'Seguros']

/**
 * Clasifica una categoría de gasto en uno de 3 grupos:
 * - operativo: costos recurrentes del negocio (nómina, alquiler, servicios, suministros, etc.)
 * - obligaciones: impuestos, seguros y similares
 * - otros: gastos puntuales o extraordinarios (tecnología, equipos, etc.)
 */
export function getCostGroup(category: string): CostGroup {
  if (OPERATIVE_CATEGORIES.some((c) => category.startsWith(c))) return 'operativo'
  if (OBLIGATION_CATEGORIES.some((c) => category.startsWith(c))) return 'obligaciones'
  return 'otros'
}

export const COST_GROUP_LABELS: Record<CostGroup, string> = {
  operativo: 'Operativo',
  obligaciones: 'Obligaciones',
  otros: 'Otros Gastos',
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

export function calcChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const diff = ((current - previous) / previous) * 100
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${diff.toFixed(1)}%`
}

/** Build month keys between two dates */
export function getMonthsBetween(start: Date, end: Date): { key: string; label: string; date: Date }[] {
  const months: { key: string; label: string; date: Date }[] = []
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

  while (d <= endMonth) {
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_LABELS[d.getMonth()],
      date: new Date(d),
    })
    d.setMonth(d.getMonth() + 1)
  }
  return months
}
