import type { AttendancePunch } from './types'

// Arma jornadas (entrada -> salida) a partir de las marcaciones sueltas.
// Logica pura para poder probarla sin Firestore.

/** Entrada sin salida mas vieja que esto: se asume que olvido marcar la salida.
 *  Es el tope del servidor (OPEN_SHIFT_MAX_MS en functions/src/attendance/match.ts);
 *  alla ademas se corta antes segun el turno de Horarios o el cambio de dia. */
export const OPEN_SHIFT_MAX_MS = 18 * 60 * 60 * 1000

export type WorkdayStatus = 'complete' | 'open' | 'missing-out' | 'missing-in' | 'absent'

export const WORKDAY_STATUS_LABEL: Record<WorkdayStatus, string> = {
  complete: 'Completa',
  open: 'En turno',
  'missing-out': 'Sin salida',
  'missing-in': 'Sin entrada',
  absent: 'Falta',
}

export interface Workday {
  id: string
  employeeId: string
  employeeName: string
  /** 'YYYY-MM-DD' de la entrada (o de la salida si no hay entrada). Un turno
   *  que cruza la medianoche queda en el dia en que empezo. */
  date: string
  inPunch?: AttendancePunch
  outPunch?: AttendancePunch
  /** Solo en jornadas completas. */
  minutes?: number
  status: WorkdayStatus
  /** Solo en faltas: el turno que no se cumplio. */
  scheduled?: { start: string; end: string }
}

type PunchLike = Pick<AttendancePunch, 'id' | 'employeeId' | 'employeeName' | 'type' | 'date'> & {
  at: { toMillis(): number }
  voided?: boolean
  missedIn?: boolean
  source?: AttendancePunch['source']
}

export function buildWorkdays<P extends PunchLike>(punches: P[], nowMs: number): Workday[] {
  const byEmployee = new Map<string, P[]>()
  for (const p of punches) {
    // Las anuladas no cuentan (quedan en Firestore solo como rastro).
    if (p.voided) continue
    const list = byEmployee.get(p.employeeId) ?? []
    list.push(p)
    byEmployee.set(p.employeeId, list)
  }

  const days: Workday[] = []
  for (const list of byEmployee.values()) {
    list.sort((a, b) => a.at.toMillis() - b.at.toMillis())
    let open: P | null = null

    const closeOpen = () => {
      if (!open) return
      const stale = nowMs - open.at.toMillis() > OPEN_SHIFT_MAX_MS
      days.push(workday(open, undefined, stale ? 'missing-out' : 'open'))
      open = null
    }

    for (const p of list) {
      if (p.type === 'in') {
        // Entrada con otra abierta: la anterior se quedo sin salida.
        if (open) {
          days.push(workday(open, undefined, 'missing-out'))
        }
        open = p
      } else if (open && closes(open, p)) {
        days.push(workday(open, p, 'complete'))
        open = null
      } else {
        // Salida sin entrada: si quedo una entrada abierta, esa no tuvo salida.
        if (open) {
          days.push(workday(open, undefined, 'missing-out'))
          open = null
        }
        days.push(workday(undefined, p, 'missing-in'))
      }
    }
    closeOpen()
  }

  return days.sort((a, b) => b.date.localeCompare(a.date) || startMs(a) - startMs(b))
}

/** Si una salida cierra la entrada abierta. No la cierra si paso el tope de
 *  horas, ni si el kiosco la marco como salida sin entrada (`missedIn`) y la
 *  abierta es otra marcacion del kiosco; una entrada que un admin agrego a mano
 *  para completar esa jornada si la cierra. */
function closes(open: PunchLike, out: PunchLike): boolean {
  if (out.at.toMillis() - open.at.toMillis() > OPEN_SHIFT_MAX_MS) return false
  return !out.missedIn || open.source === 'manual'
}

function workday(inPunch: PunchLike | undefined, outPunch: PunchLike | undefined, status: WorkdayStatus): Workday {
  const ref = (inPunch ?? outPunch)!
  return {
    id: `${ref.employeeId}-${ref.id}`,
    employeeId: ref.employeeId,
    employeeName: ref.employeeName || 'Empleado',
    date: ref.date,
    inPunch: inPunch as AttendancePunch | undefined,
    outPunch: outPunch as AttendancePunch | undefined,
    minutes: inPunch && outPunch ? Math.round((outPunch.at.toMillis() - inPunch.at.toMillis()) / 60000) : undefined,
    status,
  }
}

function startMs(w: Workday): number {
  return (w.inPunch ?? w.outPunch)!.at.toMillis()
}

/** 484 -> "8h 04m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// ── Puntualidad ─────────────────────────────────────────────────────────────
// Se compara la entrada contra el turno programado en Horarios, sin tolerancia
// (decision del founder: 8:01 ya es tarde). Se cuenta por minuto de reloj: una
// entrada a las 8:00:40 se ve como 8:00 y es puntual.

/** `earlyLeaveMinutes`: salio antes del fin del turno (solo si hay salida). */
export type Punctuality =
  | { kind: 'on-time'; scheduledStart: string; scheduledEnd: string; earlyLeaveMinutes?: number }
  | { kind: 'late'; scheduledStart: string; scheduledEnd: string; minutesLate: number; earlyLeaveMinutes?: number }
  | { kind: 'no-shift' }

/** Turno programado, lo minimo que se necesita de `Shift` (modulo schedule). */
export interface ScheduledShift {
  employeeId: string
  date: string
  start: string // 'HH:mm'
  end: string // 'HH:mm' (menor que start si cruza la medianoche)
}

/** Minuto del dia (0-1439) en hora de Colombia. Bogota es UTC-5 todo el ano. */
export function bogotaMinuteOfDay(ms: number): number {
  const minutes = Math.floor(ms / 60000) - 5 * 60
  return ((minutes % 1440) + 1440) % 1440
}

/** Turno cuyo inicio queda mas cerca de `minute` (turno partido). */
export function closestShift<S extends ScheduledShift>(candidates: S[], minute: number): S {
  return candidates.reduce((best, s) =>
    Math.abs(toMinutes(s.start) - minute) < Math.abs(toMinutes(best.start) - minute) ? s : best,
  )
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Puntualidad de una jornada. Con turno partido se toma el turno cuyo inicio
 *  queda mas cerca de la entrada. Sin entrada marcada no hay puntualidad. */
export function punctualityOf(workday: Workday, shifts: ScheduledShift[]): Punctuality | null {
  if (!workday.inPunch) return null
  const candidates = shifts.filter((s) => s.employeeId === workday.employeeId && s.date === workday.date)
  if (candidates.length === 0) return { kind: 'no-shift' }

  const arrived = bogotaMinuteOfDay(workday.inPunch.at.toMillis())
  const shift = closestShift(candidates, arrived)
  const late = arrived - toMinutes(shift.start)
  const early = earlyLeave(workday, shift)
  const base = { scheduledStart: shift.start, scheduledEnd: shift.end, ...(early > 0 ? { earlyLeaveMinutes: early } : {}) }
  return late > 0 ? { kind: 'late', minutesLate: late, ...base } : { kind: 'on-time', ...base }
}

/** Minutos que salio antes del fin del turno (0 si no salio antes o no hay salida). */
function earlyLeave(workday: Workday, shift: ScheduledShift): number {
  if (!workday.outPunch) return 0
  const start = toMinutes(shift.start)
  let end = toMinutes(shift.end)
  if (end <= start) end += 1440 // turno que cruza la medianoche
  let left = bogotaMinuteOfDay(workday.outPunch.at.toMillis())
  if (workday.outPunch.date > workday.date) left += 1440
  return Math.max(0, end - left)
}

/**
 * Faltas: turnos programados cuyo inicio ya paso y en los que el empleado no
 * tiene ninguna jornada ese dia. Las novedades (incapacidad, descanso...) no
 * cuentan como falta porque en Horarios reemplazan al turno: ese dia no hay
 * shift. Con turno partido sale una sola falta por dia (el primer turno).
 */
export function buildAbsences(
  shifts: ScheduledShift[],
  workdays: Workday[],
  employeeNames: Map<string, string>,
  nowMs: number,
): Workday[] {
  const worked = new Set(workdays.map((w) => `${w.employeeId}|${w.date}`))
  const firstShift = new Map<string, ScheduledShift>()
  for (const s of shifts) {
    const key = `${s.employeeId}|${s.date}`
    if (worked.has(key)) continue
    const startMs = new Date(`${s.date}T${s.start}:00-05:00`).getTime()
    if (startMs > nowMs) continue
    const prev = firstShift.get(key)
    if (!prev || toMinutes(s.start) < toMinutes(prev.start)) firstShift.set(key, s)
  }
  return [...firstShift.values()].map((s) => ({
    id: `absent-${s.employeeId}-${s.date}`,
    employeeId: s.employeeId,
    employeeName: employeeNames.get(s.employeeId) ?? 'Empleado',
    date: s.date,
    status: 'absent' as const,
    scheduled: { start: s.start, end: s.end },
  }))
}
