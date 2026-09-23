import type { FieldDef, SheetSpec } from '@/core/utils/data-transfer'
import { formatShiftRange, WEEKDAY_LABELS } from '@/modules/schedule/components/schedule-utils'
import { bogotaMinuteOfDay, closestShift, toMinutes, type ScheduledShift, type Workday } from './shifts'

// Horas que se pagan, a partir de la marcacion, en el mismo Excel semanal que
// exporta Horarios (`horario-AAAA-Wnn.xlsx`). Ese archivo lo lee
// `Nominas - Empresas/_script/consolidar.py`, que es el que hace la
// liquidacion legal (8 categorias, 42 h por semana, festivos, break). Aqui NO se
// liquida: solo se decide que tramo de cada jornada se paga.
//
// Regla (decision del founder, 2026-09):
// - Se paga lo que cae dentro del turno programado: llegar tarde descuenta,
//   llegar antes o quedarse despues no suma.
// - Si un admin aprobo el tiempo extra de la jornada, se paga todo lo marcado.
// - Dia sin turno en Horarios: se paga lo marcado (la descarga lo avisa).

// ── Break por marca: espejo de CONFIG_MARCA en consolidar.py ────────────────
// El total semanal del archivo tiene que calzar con esta regla: consolidar.py
// lo recalcula y aborta con "Descuadre" si no coincide.
export interface BreakRule {
  minutes: number
  thresholdHours: number
}

const BREAK_BY_BRAND: Record<string, BreakRule> = {
  blue: { minutes: 0, thresholdHours: 6 },
  filipo: { minutes: 30, thresholdHours: 6 },
}

/** Regla de la marca por la primera palabra del nombre de la company. */
export function breakRuleFor(companyName: string): BreakRule | null {
  const first = companyName.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return BREAK_BY_BRAND[first] ?? null
}

/** Minutos de descanso a descontar de un dia con `rawMinutes` trabajados. */
export function breakMinutesFor(rawMinutes: number, rule: BreakRule): number {
  return rule.minutes > 0 && rawMinutes > rule.thresholdHours * 60 ? rule.minutes : 0
}

// ── Tramo pagable de una jornada ─────────────────────────────────────────────

/** 'scheduled': empleado que no marca (jefes) y se liquida por su horario programado. */
export type PayableKind = 'shift' | 'approved' | 'no-shift' | 'scheduled'

export interface Payable {
  employeeId: string
  date: string
  /** Minutos desde las 00:00 de `date`; `end` puede pasar de 1440. */
  startMin: number
  endMin: number
  kind: PayableKind
}

/** Entrada y salida de una jornada completa en el eje de minutos de su dia. */
function markedRange(w: Workday): { from: number; to: number } | null {
  if (w.status !== 'complete' || !w.inPunch || !w.outPunch) return null
  const from = bogotaMinuteOfDay(w.inPunch.at.toMillis())
  const days = Math.round((Date.parse(`${w.outPunch.date}T00:00:00Z`) - Date.parse(`${w.date}T00:00:00Z`)) / 86_400_000)
  const to = bogotaMinuteOfDay(w.outPunch.at.toMillis()) + days * 1440
  return to > from ? { from, to } : null
}

function shiftRange(s: ScheduledShift): { from: number; to: number } {
  const from = toMinutes(s.start)
  let to = toMinutes(s.end)
  if (to <= from) to += 1440
  return { from, to }
}

function shiftFor(w: Workday, shifts: ScheduledShift[], from: number): ScheduledShift | null {
  const candidates = shifts.filter((s) => s.employeeId === w.employeeId && s.date === w.date)
  return candidates.length ? closestShift(candidates, from) : null
}

/** Tramo que se paga de una jornada. null si no es completa o si no hay nada que pagar. */
export function payableFor(w: Workday, shifts: ScheduledShift[], approved: boolean): Payable | null {
  const marked = markedRange(w)
  if (!marked) return null
  const base = { employeeId: w.employeeId, date: w.date }
  const shift = shiftFor(w, shifts, marked.from)
  if (!shift) return { ...base, startMin: marked.from, endMin: marked.to, kind: 'no-shift' }
  if (approved) return { ...base, startMin: marked.from, endMin: marked.to, kind: 'approved' }
  const s = shiftRange(shift)
  const startMin = Math.max(marked.from, s.from)
  const endMin = Math.min(marked.to, s.to)
  return endMin > startMin ? { ...base, startMin, endMin, kind: 'shift' } : null
}

/** Turnos programados de quienes se liquidan por horario (no marcan). */
export function scheduledPayables(shifts: ScheduledShift[], employeeIds: Set<string>): Payable[] {
  return shifts
    .filter((s) => employeeIds.has(s.employeeId))
    .map((s) => {
      const r = shiftRange(s)
      return { employeeId: s.employeeId, date: s.date, startMin: r.from, endMin: r.to, kind: 'scheduled' as const }
    })
}

/** Minutos marcados fuera del turno (lo que se puede aprobar como extra). 0 sin turno. */
export function outsideMinutes(w: Workday, shifts: ScheduledShift[]): number {
  const marked = markedRange(w)
  if (!marked) return 0
  const shift = shiftFor(w, shifts, marked.from)
  if (!shift) return 0
  const s = shiftRange(shift)
  const inside = Math.max(0, Math.min(marked.to, s.to) - Math.max(marked.from, s.from))
  return marked.to - marked.from - inside
}

// ── Semanas ISO de una quincena ──────────────────────────────────────────────

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7) }
}

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface IsoWeek {
  /** 'horario-2026-W38' */
  fileName: string
  monday: string
  dates: string[]
}

/** Q1 = 1 al 15, Q2 = 16 al fin de mes (igual que consolidar.py). */
export function fortnightRange(year: number, month: number, q: 1 | 2): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, '0')
  return q === 1 ? { from: `${year}-${mm}-01`, to: `${year}-${mm}-15` } : { from: `${year}-${mm}-16`, to: `${year}-${mm}-${last}` }
}

/** Semanas ISO completas que tocan el rango, incluidas las de borde: consolidar.py
 *  las necesita enteras para llevar el acumulado de 42 h de la semana. */
export function isoWeeksCovering(from: string, to: string): IsoWeek[] {
  const monday = utc(from)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const weeks: IsoWeek[] = []
  for (const d = monday; iso(d) <= to; d.setUTCDate(d.getUTCDate() + 7)) {
    const { year, week } = isoWeek(d)
    const dates = Array.from({ length: 7 }, (_, i) => {
      const x = new Date(d)
      x.setUTCDate(x.getUTCDate() + i)
      return iso(x)
    })
    weeks.push({ fileName: `horario-${year}-W${String(week).padStart(2, '0')}`, monday: iso(d), dates })
  }
  return weeks
}

// ── Excel semanal (mismo formato que buildScheduleSheet de Horarios) ──────────

export interface PayrollEmployee {
  id: string
  name: string
  identification: string
  department: string
}

export interface PayrollNovelty {
  employeeId: string
  date: string
  typeName: string
  notes?: string
}

function hhmm(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** '7.75h': dos decimales para que el autochequeo de consolidar.py (tolerancia
 *  0.06 h) cuadre con horas de reloj que no son medias horas. */
function formatTotal(minutes: number): string {
  const h = Math.round((minutes / 60) * 100) / 100
  return `${h}h`
}

export function buildPayrollWeekSheets(args: {
  week: IsoWeek
  employees: PayrollEmployee[]
  payables: Payable[]
  novelties: PayrollNovelty[]
  rule: BreakRule
}): SheetSpec[] {
  const { week, employees, payables, novelties, rule } = args
  const dayKeys = week.dates.map((_, i) => `d${i}`)
  const fields: FieldDef[] = [
    { key: 'empleado', header: 'Empleado', type: 'string' },
    { key: 'documento', header: 'Documento', type: 'string' },
    { key: 'departamento', header: 'Departamento', type: 'string' },
    ...week.dates.map((d, i) => ({ key: dayKeys[i], header: `${WEEKDAY_LABELS[i]} ${Number(d.slice(8))}`, type: 'string' as const })),
    { key: 'total', header: 'Total', type: 'string' },
  ]

  const inWeek = new Set(week.dates)
  const payByCell = new Map<string, Payable[]>()
  for (const p of payables) {
    if (!inWeek.has(p.date)) continue
    const k = `${p.employeeId}|${p.date}`
    payByCell.set(k, [...(payByCell.get(k) ?? []), p].sort((a, b) => a.startMin - b.startMin))
  }
  const novByCell = new Map(novelties.filter((n) => inWeek.has(n.date)).map((n) => [`${n.employeeId}|${n.date}`, n]))

  const data: Record<string, unknown>[] = []
  for (const emp of employees) {
    const row: Record<string, unknown> = { empleado: emp.name, documento: emp.identification, departamento: emp.department }
    let total = 0
    let hasContent = false
    week.dates.forEach((date, i) => {
      const key = `${emp.id}|${date}`
      const nov = novByCell.get(key)
      const pays = payByCell.get(key) ?? []
      if (nov) {
        row[dayKeys[i]] = nov.typeName
        hasContent = true
      } else if (pays.length) {
        row[dayKeys[i]] = pays.map((p) => formatShiftRange(hhmm(p.startMin), hhmm(p.endMin))).join(' / ')
        const raw = pays.reduce((a, p) => a + p.endMin - p.startMin, 0)
        total += raw - breakMinutesFor(raw, rule)
        hasContent = true
      } else {
        row[dayKeys[i]] = ''
      }
    })
    if (!hasContent) continue
    row.total = formatTotal(total)
    data.push(row)
  }

  const empById = new Map(employees.map((e) => [e.id, e]))
  const noveltyFields: FieldDef[] = [
    { key: 'fecha', header: 'Fecha', type: 'string' },
    { key: 'empleado', header: 'Empleado', type: 'string' },
    { key: 'documento', header: 'Documento', type: 'string' },
    { key: 'departamento', header: 'Departamento', type: 'string' },
    { key: 'novedad', header: 'Novedad', type: 'string' },
    { key: 'notas', header: 'Notas', type: 'string' },
  ]
  const noveltyData = novelties
    .filter((n) => inWeek.has(n.date) && empById.has(n.employeeId))
    .map((n) => {
      const emp = empById.get(n.employeeId)!
      return {
        fecha: `${n.date} (${WEEKDAY_LABELS[week.dates.indexOf(n.date)]})`,
        empleado: emp.name,
        documento: emp.identification,
        departamento: emp.department,
        novedad: n.typeName,
        notas: n.notes ?? '',
      }
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.empleado.localeCompare(b.empleado))

  return [
    { name: week.fileName.replace('horario-', ''), data, fields },
    { name: 'Novedades', data: noveltyData, fields: noveltyFields },
  ]
}

/** Novedades que consolidar.py reconoce como celda valida (su dict NOVEDADES). */
export const CONSOLIDAR_NOVELTIES = new Set([
  'Descanso', 'Permiso No Remunerado', 'Vacaciones', 'Incapacidad', 'Retiro', 'Dia de Cumpleaños',
])
