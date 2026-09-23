import { describe, it, expect } from 'vitest'
import { buildPunctualityReport, levelOf } from './report'
import type { Punctuality, WorkdayStatus } from './shifts'

const onTime = (early?: number): Punctuality => ({ kind: 'on-time', scheduledStart: '08:00', scheduledEnd: '16:00', ...(early ? { earlyLeaveMinutes: early } : {}) })
const late = (min: number): Punctuality => ({ kind: 'late', scheduledStart: '08:00', scheduledEnd: '16:00', minutesLate: min })

function row(employeeId: string, date: string, punctuality: Punctuality | null, status: WorkdayStatus = 'complete') {
  return { employeeId, employeeName: employeeId.toUpperCase(), date, status, punctuality }
}

describe('buildPunctualityReport', () => {
  it('calcula % sobre jornadas medibles y suma minutos tarde', () => {
    const [ana] = buildPunctualityReport([
      row('ana', '2026-09-21', onTime()),
      row('ana', '2026-09-22', late(12)),
      row('ana', '2026-09-23', late(3)),
      row('ana', '2026-09-24', onTime()),
    ])
    expect(ana).toMatchObject({ measured: 4, onTime: 2, late: 2, lateMinutes: 15, rate: 50, level: 'bad' })
    expect(ana.lateDays.map((d) => d.date)).toEqual(['2026-09-23', '2026-09-22'])
  })

  it('las faltas y los dias sin horario no entran al %', () => {
    const [ana] = buildPunctualityReport([
      row('ana', '2026-09-21', onTime()),
      row('ana', '2026-09-22', null, 'absent'),
      row('ana', '2026-09-23', { kind: 'no-shift' }),
    ])
    expect(ana).toMatchObject({ measured: 1, rate: 100, absences: 1 })
  })

  it('cuenta salidas anticipadas', () => {
    const [ana] = buildPunctualityReport([row('ana', '2026-09-21', onTime(20)), row('ana', '2026-09-22', onTime(10))])
    expect(ana).toMatchObject({ earlyLeaves: 2, earlyMinutes: 30 })
  })

  it('ordena del mas puntual al menos; empate por minutos tarde; sin datos al final', () => {
    const report = buildPunctualityReport([
      row('beto', '2026-09-21', late(30)),
      row('beto', '2026-09-22', onTime()),
      row('carla', '2026-09-21', late(5)),
      row('carla', '2026-09-22', onTime()),
      row('ana', '2026-09-21', onTime()),
      row('dani', '2026-09-21', { kind: 'no-shift' }),
    ])
    expect(report.map((e) => e.employeeId)).toEqual(['ana', 'carla', 'beto', 'dani'])
    expect(report[3].rate).toBeNull()
  })
})

describe('levelOf', () => {
  it('semaforo', () => {
    expect(levelOf(100)).toBe('good')
    expect(levelOf(95)).toBe('good')
    expect(levelOf(90)).toBe('warn')
    expect(levelOf(79.9)).toBe('bad')
    expect(levelOf(null)).toBeNull()
  })
})
