import { describe, it, expect } from 'vitest'
import { buildAbsences, buildWorkdays, bogotaMinuteOfDay, formatDuration, punctualityOf } from './shifts'

const H = 60 * 60 * 1000
const BASE = Date.UTC(2026, 8, 22, 13, 0) // 22-sep 8:00 a. m. en Bogota

let seq = 0
function punch(employeeId: string, type: 'in' | 'out', offsetH: number, date = '2026-09-22') {
  const ms = BASE + offsetH * H
  seq += 1
  return { id: `p${seq}`, employeeId, employeeName: employeeId.toUpperCase(), type, date, at: { toMillis: () => ms } }
}

const LATER = BASE + 72 * H

describe('buildWorkdays', () => {
  it('une entrada y salida en una jornada completa', () => {
    const [w] = buildWorkdays([punch('ana', 'out', 8), punch('ana', 'in', 0)], LATER)
    expect(w.status).toBe('complete')
    expect(w.minutes).toBe(480)
  })

  it('un turno que cruza la medianoche queda en el dia de la entrada', () => {
    const days = buildWorkdays([punch('ana', 'in', 10, '2026-09-22'), punch('ana', 'out', 18, '2026-09-23')], LATER)
    expect(days).toHaveLength(1)
    expect(days[0].date).toBe('2026-09-22')
    expect(days[0].minutes).toBe(480)
  })

  it('entrada seguida de otra entrada deja la primera sin salida', () => {
    const days = buildWorkdays(
      [punch('ana', 'in', 0), punch('ana', 'in', 24, '2026-09-23'), punch('ana', 'out', 32, '2026-09-23')],
      LATER,
    )
    expect(days.map((d) => [d.date, d.status])).toEqual([
      ['2026-09-23', 'complete'],
      ['2026-09-22', 'missing-out'],
    ])
  })

  it('una salida sin entrada queda como sin entrada', () => {
    const [w] = buildWorkdays([punch('ana', 'out', 8)], LATER)
    expect(w.status).toBe('missing-in')
    expect(w.minutes).toBeUndefined()
  })

  it('no mezcla empleados intercalados', () => {
    const days = buildWorkdays(
      [punch('ana', 'in', 0), punch('beto', 'in', 1), punch('ana', 'out', 8), punch('beto', 'out', 9.5)],
      LATER,
    )
    const byName = Object.fromEntries(days.map((d) => [d.employeeId, d.minutes]))
    expect(byName).toEqual({ ana: 480, beto: 510 })
  })

  it('entrada reciente sin salida esta en turno; vieja, sin salida', () => {
    expect(buildWorkdays([punch('ana', 'in', 0)], BASE + 4 * H)[0].status).toBe('open')
    expect(buildWorkdays([punch('ana', 'in', 0)], BASE + 20 * H)[0].status).toBe('missing-out')
  })
})

describe('formatDuration', () => {
  it('formatea horas y minutos', () => {
    expect(formatDuration(484)).toBe('8h 04m')
    expect(formatDuration(45)).toBe('0h 45m')
  })
})

describe('punctualityOf', () => {
  const shift = (start: string, employeeId = 'ana', date = '2026-09-22', end = '16:00') => ({ employeeId, date, start, end })
  // BASE es 8:00 a. m. en Bogota.
  const dayAt = (offsetMin: number) => buildWorkdays([punch('ana', 'in', offsetMin / 60)], LATER)[0]

  it('entrada exacta o antes es puntual', () => {
    expect(punctualityOf(dayAt(0), [shift('08:00')])).toEqual({ kind: 'on-time', scheduledStart: '08:00', scheduledEnd: '16:00' })
    expect(punctualityOf(dayAt(-5), [shift('08:00')])?.kind).toBe('on-time')
  })

  it('sin tolerancia: un minuto tarde ya es tarde', () => {
    expect(punctualityOf(dayAt(1), [shift('08:00')])).toEqual({ kind: 'late', scheduledStart: '08:00', scheduledEnd: '16:00', minutesLate: 1 })
  })

  it('los segundos no cuentan: 8:00:40 es puntual', () => {
    expect(punctualityOf(dayAt(40 / 60), [shift('08:00')])?.kind).toBe('on-time')
  })

  it('con turno partido usa el turno mas cercano a la entrada', () => {
    const p = punctualityOf(dayAt(6 * 60 + 10), [shift('08:00'), shift('14:00')])
    expect(p).toMatchObject({ kind: 'late', scheduledStart: '14:00', minutesLate: 10 })
  })

  it('sin turno programado ese dia, o de otro empleado', () => {
    expect(punctualityOf(dayAt(0), [])).toEqual({ kind: 'no-shift' })
    expect(punctualityOf(dayAt(0), [shift('08:00', 'beto')])).toEqual({ kind: 'no-shift' })
  })

  it('sin entrada no hay puntualidad', () => {
    const w = buildWorkdays([punch('ana', 'out', 8)], LATER)[0]
    expect(punctualityOf(w, [shift('08:00')])).toBeNull()
  })

  it('bogotaMinuteOfDay convierte desde UTC', () => {
    expect(bogotaMinuteOfDay(BASE)).toBe(8 * 60)
    expect(bogotaMinuteOfDay(Date.UTC(2026, 8, 23, 3, 30))).toBe(22 * 60 + 30)
  })
})

describe('salida antes de tiempo y faltas', () => {
  const shift = (start: string, end: string, employeeId = 'ana', date = '2026-09-22') => ({ employeeId, date, start, end })

  it('mide la salida anticipada contra el fin del turno', () => {
    const w = buildWorkdays([punch('ana', 'in', 0), punch('ana', 'out', 7.5)], LATER)[0]
    expect(punctualityOf(w, [shift('08:00', '16:00')])).toMatchObject({ kind: 'on-time', earlyLeaveMinutes: 30 })
  })

  it('salir a tiempo o despues no cuenta como anticipada', () => {
    const w = buildWorkdays([punch('ana', 'in', 0), punch('ana', 'out', 8.2)], LATER)[0]
    expect(punctualityOf(w, [shift('08:00', '16:00')])).not.toHaveProperty('earlyLeaveMinutes')
  })

  it('turno nocturno: la salida del dia siguiente se compara bien', () => {
    // Entra 6 p. m., turno hasta las 2 a. m., sale 1:30 a. m. del 23.
    const w = buildWorkdays([punch('ana', 'in', 10), punch('ana', 'out', 17.5, '2026-09-23')], LATER)[0]
    expect(punctualityOf(w, [shift('18:00', '02:00')])).toMatchObject({ kind: 'on-time', earlyLeaveMinutes: 30 })
  })

  it('las anuladas no cuentan', () => {
    const voided = { ...punch('ana', 'in', 0), voided: true }
    expect(buildWorkdays([voided], LATER)).toHaveLength(0)
  })

  it('falta: turno ya empezado sin ninguna jornada ese dia', () => {
    const names = new Map([['beto', 'Beto']])
    const workdays = buildWorkdays([punch('ana', 'in', 0)], LATER)
    const absences = buildAbsences([shift('08:00', '16:00'), shift('08:00', '16:00', 'beto')], workdays, names, LATER)
    expect(absences.map((a) => [a.employeeName, a.status])).toEqual([['Beto', 'absent']])
  })

  it('un turno que todavia no empieza no es falta', () => {
    const absences = buildAbsences([shift('08:00', '16:00', 'beto')], [], new Map(), BASE - H)
    expect(absences).toHaveLength(0)
  })

  it('turno partido sin marcar: una sola falta con el primer turno', () => {
    const absences = buildAbsences([shift('14:00', '18:00', 'beto'), shift('08:00', '12:00', 'beto')], [], new Map(), LATER)
    expect(absences).toHaveLength(1)
    expect(absences[0].scheduled).toEqual({ start: '08:00', end: '12:00' })
  })
})
