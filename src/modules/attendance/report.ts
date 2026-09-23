import type { Punctuality, WorkdayStatus } from './shifts'

// Informe de puntualidad por empleado. Logica pura sobre las filas que ya arma
// la pestana Marcaciones (jornadas + faltas con su puntualidad).

/** Semaforo por % de puntualidad. */
export const PUNCTUALITY_GOOD = 95
export const PUNCTUALITY_WARN = 80

export type PunctualityLevel = 'good' | 'warn' | 'bad'

export interface EmployeePunctuality {
  employeeId: string
  employeeName: string
  /** Jornadas con horario en las que marco entrada (base del %). */
  measured: number
  onTime: number
  late: number
  lateMinutes: number
  absences: number
  earlyLeaves: number
  earlyMinutes: number
  /** % de llegadas a tiempo sobre `measured`. null si no hay nada que medir. */
  rate: number | null
  level: PunctualityLevel | null
  /** Dias en que llego tarde, para el detalle. */
  lateDays: { date: string; scheduledStart: string; minutesLate: number }[]
}

interface RowLike {
  employeeId: string
  employeeName: string
  date: string
  status: WorkdayStatus
  punctuality: Punctuality | null
}

export function levelOf(rate: number | null): PunctualityLevel | null {
  if (rate == null) return null
  return rate >= PUNCTUALITY_GOOD ? 'good' : rate >= PUNCTUALITY_WARN ? 'warn' : 'bad'
}

/**
 * Agrupa por empleado. El % es sobre jornadas con horario en las que hubo
 * entrada: las faltas se cuentan aparte (no son una llegada tarde) y los dias
 * sin horario no se pueden medir. Orden: mas puntual primero; a igual %, menos
 * minutos tarde y menos faltas. Quien no tiene nada medible va al final.
 */
export function buildPunctualityReport(rows: RowLike[]): EmployeePunctuality[] {
  const map = new Map<string, EmployeePunctuality>()
  for (const r of rows) {
    let e = map.get(r.employeeId)
    if (!e) {
      e = {
        employeeId: r.employeeId, employeeName: r.employeeName, measured: 0, onTime: 0, late: 0, lateMinutes: 0,
        absences: 0, earlyLeaves: 0, earlyMinutes: 0, rate: null, level: null, lateDays: [],
      }
      map.set(r.employeeId, e)
    }
    if (r.status === 'absent') {
      e.absences += 1
      continue
    }
    const p = r.punctuality
    if (!p || p.kind === 'no-shift') continue
    e.measured += 1
    if (p.kind === 'on-time') e.onTime += 1
    else {
      e.late += 1
      e.lateMinutes += p.minutesLate
      e.lateDays.push({ date: r.date, scheduledStart: p.scheduledStart, minutesLate: p.minutesLate })
    }
    if (p.earlyLeaveMinutes) {
      e.earlyLeaves += 1
      e.earlyMinutes += p.earlyLeaveMinutes
    }
  }

  const list = [...map.values()]
  for (const e of list) {
    e.rate = e.measured > 0 ? Math.round((e.onTime / e.measured) * 1000) / 10 : null
    e.level = levelOf(e.rate)
    e.lateDays.sort((a, b) => b.date.localeCompare(a.date))
  }
  return list.sort(
    (a, b) =>
      (b.rate ?? -1) - (a.rate ?? -1) ||
      a.lateMinutes - b.lateMinutes ||
      a.absences - b.absences ||
      a.employeeName.localeCompare(b.employeeName, 'es'),
  )
}
