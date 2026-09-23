import { useMemo } from 'react'
import { useEmployees } from '@/modules/talent/hooks'
import { useFaceProfiles, usePunchesByRange, useScheduledShifts } from './hooks'
import { buildAbsences, buildWorkdays, punctualityOf, type Punctuality, type Workday } from './shifts'
import { outsideMinutes } from './payroll'

/** Jornada (o falta) con su puntualidad ya calculada. `outsideMinutes`: marcado
 *  fuera del turno, que solo se paga si se aprueba (`extraApproved`). */
export type AttendanceRow = Workday & { punctuality: Punctuality | null; outsideMinutes: number; extraApproved: boolean }

/**
 * Jornadas + faltas de un rango, con puntualidad contra Horarios. Lo comparten
 * la pestana Marcaciones y el informe de Puntualidad para que los dos cuenten
 * exactamente lo mismo.
 */
export function useAttendanceRows(from: string, to: string) {
  const { data: punches, loading } = usePunchesByRange(from, to)
  const shifts = useScheduledShifts(from, to)
  const { data: profiles } = useFaceProfiles()
  const { data: employees } = useEmployees()

  const thumbs = useMemo(() => new Map(profiles.map((p) => [p.id, p.thumb])), [profiles])
  const employeeNames = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees])
  const activeEmployees = useMemo(
    () =>
      employees
        .filter((e) => e.status === 'active')
        .map((e) => ({ id: e.id, name: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [employees],
  )

  const rows = useMemo<AttendanceRow[]>(() => {
    const now = Date.now()
    const days = buildWorkdays(punches, now)
    const absences = buildAbsences(shifts, days, employeeNames, now)
    return [
      ...days.map((w) => ({
        ...w,
        punctuality: punctualityOf(w, shifts),
        outsideMinutes: outsideMinutes(w, shifts),
        extraApproved: !!w.inPunch?.extraApprovedBy,
      })),
      ...absences.map((a) => ({ ...a, punctuality: null, outsideMinutes: 0, extraApproved: false })),
    ].sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName, 'es'))
  }, [punches, shifts, employeeNames])

  return { rows, loading, thumbs, activeEmployees, hasSchedule: shifts.length > 0 }
}

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
