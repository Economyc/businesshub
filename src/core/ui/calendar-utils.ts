// Utilidades compartidas por los calendarios (DateInput y DateRangeCalendar).

export const MONTHS_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
export const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

export interface CalendarDay {
  day: number
  current: boolean
  iso: string
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export function toISO(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

export function todayISO() {
  const now = new Date()
  return toISO(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Grilla de 42 días (6 semanas, lunes primero) para el mes dado. */
export function buildCalendarDays(viewYear: number, viewMonth: number): CalendarDay[] {
  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay = new Date(viewYear, viewMonth + 1, 0)
  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days: CalendarDay[] = []

  // Previous month padding
  const prevLastDay = new Date(viewYear, viewMonth, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLastDay - i
    const m = viewMonth === 0 ? 11 : viewMonth - 1
    const y = viewMonth === 0 ? viewYear - 1 : viewYear
    days.push({ day: d, current: false, iso: toISO(y, m, d) })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ day: d, current: true, iso: toISO(viewYear, viewMonth, d) })
  }

  // Next month padding
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1
    const y = viewMonth === 11 ? viewYear + 1 : viewYear
    days.push({ day: d, current: false, iso: toISO(y, m, d) })
  }

  return days
}
