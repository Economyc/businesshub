import type { Employee } from '@/modules/talent/types'
import type { SheetSpec, FieldDef } from '@/core/utils/data-transfer'
import type { Shift, Novelty } from '../types'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const WEEKDAY_LABELS = DAY_LABELS

/** 'YYYY-MM-DD' a partir de los componentes locales (sin saltos por timezone). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parsea 'YYYY-MM-DD' como fecha local (mediodía para evitar bordes de DST). */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

/** 'HH:mm' (24h) → formato 12h con am/pm. Ej: '16:00' → '4:00 pm', '08:00' → '8:00 am'. */
export function formatTime12h(hhmm: string): string {
  const [hStr, m = '00'] = (hhmm ?? '').split(':')
  let h = Number(hStr)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'pm' : 'am'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${period}`
}

/** Rango de turno en 12h. Ej: ('08:00','16:00') → '8:00 am – 4:00 pm'. */
export function formatShiftRange(start: string, end: string): string {
  return `${formatTime12h(start)} – ${formatTime12h(end)}`
}

/** 'HH:mm' (24h) → 12h compacto. '16:00' → '4p'; '16:30' → '4:30p'. */
export function formatTime12hCompact(hhmm: string): string {
  const [hStr, m = '00'] = (hhmm ?? '').split(':')
  let h = Number(hStr)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'p' : 'a'
  h = h % 12
  if (h === 0) h = 12
  return m === '00' ? `${h}${period}` : `${h}:${m}${period}`
}

/** Rango compacto. ('08:00','16:00') → '8a–4p'. */
export function formatShiftRangeCompact(start: string, end: string): string {
  return `${formatTime12hCompact(start)}–${formatTime12hCompact(end)}`
}

/** Lunes (inicio de semana) de la fecha dada, a medianoche local. */
export function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (r.getDay() + 6) % 7 // Lun=0 … Dom=6
  r.setDate(r.getDate() - dow)
  return r
}

/** weekKey ISO ('YYYY-Www') estable e independiente de timezone. */
export function weekKeyOf(d: Date): string {
  // Normalizamos a UTC con los componentes locales para que el cálculo ISO no
  // dependa del huso. ISO: la semana 1 es la que contiene el primer jueves.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // jueves de esta semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Las 7 fechas ('YYYY-MM-DD') Lun→Dom de la semana que contiene `monday`. */
export function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toDateStr(d)
  })
}

/** Suma `n` semanas (puede ser negativo) y devuelve el nuevo lunes. */
export function addWeeks(monday: Date, n: number): Date {
  const d = new Date(monday)
  d.setDate(monday.getDate() + n * 7)
  return d
}

/** Etiqueta legible del rango de la semana: "12 – 18 may 2026". */
export function weekLabel(monday: Date): string {
  const end = new Date(monday)
  end.setDate(monday.getDate() + 6)
  const sameMonth = monday.getMonth() === end.getMonth()
  const left = sameMonth ? `${monday.getDate()}` : `${monday.getDate()} ${MONTHS[monday.getMonth()]}`
  return `${left} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Horas netas de un turno (descuenta break; soporta turno que cruza medianoche). */
export function shiftHours(start: string, end: string, breakMin = 0): number {
  let mins = toMin(end) - toMin(start)
  if (mins < 0) mins += 24 * 60 // cruza medianoche
  mins -= breakMin
  return Math.max(0, mins) / 60
}

/** Total de horas de una lista de turnos. */
export function totalHours(shifts: Shift[]): number {
  return shifts.reduce((sum, s) => sum + shiftHours(s.start, s.end, s.breakMin), 0)
}

/** ¿Se solapan dos turnos del mismo día? (detección básica de doble-booking). */
export function shiftsOverlap(a: Shift, b: Shift): boolean {
  if (a.date !== b.date) return false
  const aStart = toMin(a.start)
  const aEnd = toMin(a.end) <= aStart ? toMin(a.end) + 24 * 60 : toMin(a.end)
  const bStart = toMin(b.start)
  const bEnd = toMin(b.end) <= bStart ? toMin(b.end) + 24 * 60 : toMin(b.end)
  return aStart < bEnd && bStart < aEnd
}

/**
 * Agrupa empleados por departamento; sin depto → "Sin departamento".
 * Si se pasa `order`, las secciones siguen ese orden (case-insensitive) y los
 * departamentos fuera de la lista van al final, alfabéticos entre sí. Sin
 * `order` el orden es alfabético (comportamiento por defecto en App1).
 */
export function groupByDepartment(
  employees: Employee[],
  order?: string[],
): { department: string; employees: Employee[] }[] {
  const map = new Map<string, Employee[]>()
  for (const e of employees) {
    const dep = e.department?.trim() || 'Sin departamento'
    if (!map.has(dep)) map.set(dep, [])
    map.get(dep)!.push(e)
  }
  const rank = (d: string) => {
    if (!order) return -1
    const i = order.findIndex((o) => o.toLowerCase() === d.toLowerCase())
    return i === -1 ? Infinity : i
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      const ra = rank(a)
      const rb = rank(b)
      return ra !== rb ? ra - rb : a.localeCompare(b)
    })
    .map(([department, list]) => ({
      department,
      employees: list.sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

/** Formatea horas como "8.5h". */
export function formatHours(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`
}

/**
 * Construye el `SheetSpec[]` para exportar el horario a Excel replicando la
 * grilla (empleados × días). Una fila por empleado más una fila de total
 * semanal al final. Cada celda de día = rango(s) del turno, o el nombre de la
 * novedad si la celda es un día de novedad (igual que la vista). Incluye una
 * segunda hoja "Novedades" con el detalle de las novedades de la semana.
 * Función pura para mantenerla testeable y fuera del componente.
 */
export function buildScheduleSheet(args: {
  weekName: string
  dates: string[]
  groups: { department: string; employees: Employee[] }[]
  byCell: ReadonlyMap<string, Shift[]>
  noveltyByCell: ReadonlyMap<string, Novelty>
  metrics: ReadonlyMap<string, { hours: number }>
  weekTotal: number
  shifts: Shift[]
  novelties: Novelty[]
}): SheetSpec[] {
  const { weekName, dates, groups, byCell, noveltyByCell, metrics, weekTotal, shifts, novelties } = args

  const dayKeys = dates.map((_, i) => `d${i}`)
  const fields: FieldDef[] = [
    { key: 'empleado', header: 'Empleado', type: 'string' },
    { key: 'documento', header: 'Documento', type: 'string' },
    { key: 'departamento', header: 'Departamento', type: 'string' },
    ...dates.map((d, i) => ({
      key: dayKeys[i],
      header: `${WEEKDAY_LABELS[i]} ${parseDateStr(d).getDate()}`,
      type: 'string' as const,
    })),
    { key: 'total', header: 'Total', type: 'string' },
  ]

  // Texto de una celda: novedad reemplaza el día; si no, los rangos de turno.
  function cellText(employeeId: string, date: string): string {
    const novelty = noveltyByCell.get(`${employeeId}|${date}`)
    if (novelty) return novelty.typeName
    const cellShifts = byCell.get(`${employeeId}|${date}`) ?? []
    return cellShifts.map((s) => formatShiftRange(s.start, s.end)).join(' / ')
  }

  const data: Record<string, unknown>[] = []
  for (const group of groups) {
    for (const emp of group.employees) {
      const row: Record<string, unknown> = {
        empleado: emp.name,
        documento: emp.identification ?? '',
        departamento: group.department,
        total: formatHours(metrics.get(emp.id)?.hours ?? 0),
      }
      dates.forEach((d, i) => { row[dayKeys[i]] = cellText(emp.id, d) })
      data.push(row)
    }
  }

  // Fila de totales por día (mismo cálculo que el footer de la grilla).
  const totalRow: Record<string, unknown> = {
    empleado: 'Total semana',
    documento: '',
    departamento: '',
    total: formatHours(weekTotal),
  }
  dates.forEach((d, i) => {
    const dayHours = totalHours(shifts.filter((s) => s.date === d))
    totalRow[dayKeys[i]] = dayHours > 0 ? formatHours(dayHours) : ''
  })
  data.push(totalRow)

  // Hoja "Novedades": lista plana de las novedades de la semana. Se incluye
  // siempre (solo encabezados si no hay) para que el archivo tenga estructura
  // estable. Novedades de empleados fuera de los grupos visibles se omiten,
  // igual que en la grilla.
  const empById = new Map<string, { name: string; identification: string; department: string }>()
  for (const group of groups) {
    for (const emp of group.employees) {
      empById.set(emp.id, {
        name: emp.name,
        identification: emp.identification ?? '',
        department: group.department,
      })
    }
  }

  const noveltyFields: FieldDef[] = [
    { key: 'fecha', header: 'Fecha', type: 'string' },
    { key: 'empleado', header: 'Empleado', type: 'string' },
    { key: 'documento', header: 'Documento', type: 'string' },
    { key: 'departamento', header: 'Departamento', type: 'string' },
    { key: 'novedad', header: 'Novedad', type: 'string' },
    { key: 'notas', header: 'Notas', type: 'string' },
  ]

  const noveltyData = novelties
    .filter((n) => empById.has(n.employeeId))
    .map((n) => {
      const emp = empById.get(n.employeeId)!
      const day = parseDateStr(n.date)
      return {
        fecha: `${n.date} (${WEEKDAY_LABELS[(day.getDay() + 6) % 7]})`,
        empleado: emp.name,
        documento: emp.identification,
        departamento: emp.department,
        novedad: n.typeName,
        notas: n.notes ?? '',
      }
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.empleado.localeCompare(b.empleado))

  return [
    { name: weekName, data, fields },
    { name: 'Novedades', data: noveltyData, fields: noveltyFields },
  ]
}
