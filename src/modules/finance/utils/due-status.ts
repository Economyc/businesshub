// Lógica de vencimiento de facturas a crédito. Es una función pura que se
// calcula en runtime comparando dueDate con hoy — NO se muta el status en
// Firestore ni hay cron. Así la alerta siempre es correcta sin mantener estado.
// El status='overdue' manual del modelo se conserva aparte (lo usa el SelectInput
// del form y la query de pendientes); la alerta visual depende solo de dueDate.

import type { Timestamp } from 'firebase/firestore'
import type { Transaction } from '../types'

export type DueLevel = 'overdue' | 'due-soon' | 'ok'

// Umbral de "por vencer": facturas que vencen dentro de los próximos N días.
export const DUE_SOON_DAYS = 3

export interface DueInfo {
  level: DueLevel
  // Días-calendario hasta el vencimiento. Negativo => ya venció (días de atraso);
  // 0 => vence hoy; positivo => faltan días.
  daysUntil: number
}

// Lleva una fecha a medianoche local, descartando la hora (evita líos de TZ al
// comparar por día). Acepta Date o Timestamp.
function toLocalMidnight(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

// Diferencia en días-calendario entre dos fechas a medianoche (b - a).
function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

// Estado de vencimiento de una transacción. Devuelve null cuando no aplica:
// no es factura, ya está pagada, o no tiene fecha límite (data legacy).
export function getDueInfo(t: Transaction, now: Date = new Date()): DueInfo | null {
  if (t.documentKind !== 'invoice') return null
  if (t.status === 'paid') return null
  if (!t.dueDate) return null

  const due = toLocalMidnight((t.dueDate as Timestamp).toDate())
  const today = toLocalMidnight(now)
  const daysUntil = dayDiff(today, due)

  if (daysUntil < 0) return { level: 'overdue', daysUntil }
  if (daysUntil <= DUE_SOON_DAYS) return { level: 'due-soon', daysUntil }
  return { level: 'ok', daysUntil }
}

// Etiqueta corta para el badge de la columna "Vence".
export function dueLabel(info: DueInfo): string {
  if (info.level === 'overdue') return `Vencida ${-info.daysUntil}d`
  if (info.level === 'due-soon') return info.daysUntil === 0 ? 'Vence hoy' : `${info.daysUntil}d`
  return ''
}

// Suma n días a una fecha ISO (YYYY-MM-DD) y devuelve otra ISO. Se usa para
// pre-llenar la fecha límite = emisión + plazo por defecto de la empresa.
// Compartido por el form de edición y el diálogo de alta.
export function addDaysISO(iso: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
