import { Timestamp } from 'firebase/firestore'
import type { Fortnight } from '../types-payroll'

export type { Fortnight }

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/**
 * Fecha de devengo a partir de (mes 'YYYY-MM' + quincena). Q1 → día 15; Q2 y
 * mes completo → último día del mes. Anclada a mediodía para que el mes sea
 * inmune a la zona horaria (mismo patrón que parseISO en payroll-view).
 */
export function accrualDateFrom(accrualMonth: string, fortnight: Fortnight): Date {
  const [y, m] = accrualMonth.split('-').map(Number) // m: 1-12
  if (fortnight === 'Q1') return new Date(y, m - 1, 15, 12, 0, 0)
  return new Date(y, m, 0, 12, 0, 0) // day 0 del mes siguiente = último día del mes
}

export function accrualTimestamp(accrualMonth: string, fortnight: Fortnight): Timestamp {
  return Timestamp.fromDate(accrualDateFrom(accrualMonth, fortnight))
}

/** Etiqueta legible: "Q2 mayo 2026" (quincena) o "Mayo 2026" (mes completo). */
export function accrualLabel(accrualMonth: string, fortnight: Fortnight): string {
  const [y, m] = accrualMonth.split('-').map(Number)
  const mes = MESES_ES[m - 1] ?? ''
  if (fortnight === 'full') return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${y}`
  return `${fortnight} ${mes} ${y}`
}
