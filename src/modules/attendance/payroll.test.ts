import { describe, it, expect } from 'vitest'
import { buildWorkdays } from './shifts'
import {
  breakMinutesFor,
  breakRuleFor,
  buildPayrollWeekSheets,
  fortnightRange,
  isoWeeksCovering,
  outsideMinutes,
  payableFor,
  scheduledPayables,
} from './payroll'

const H = 60 * 60 * 1000
const BASE = Date.UTC(2026, 8, 22, 13, 0) // lun 22-sep 8:00 a. m. Bogota
const LATER = BASE + 72 * H
let seq = 0
function punch(type: 'in' | 'out', offsetH: number, date = '2026-09-22', employeeId = 'ana') {
  const ms = BASE + offsetH * H
  seq += 1
  return { id: `p${seq}`, employeeId, employeeName: 'Ana', type, date, at: { toMillis: () => ms } }
}
const day = (inH: number, outH: number, outDate = '2026-09-22') =>
  buildWorkdays([punch('in', inH), punch('out', outH, outDate)], LATER)[0]
const shift = (start: string, end: string, date = '2026-09-22') => ({ employeeId: 'ana', date, start, end })

describe('payableFor', () => {
  it('llego tarde y salio temprano: paga solo lo trabajado dentro del turno', () => {
    // turno 8-16, llega 8:10, sale 15:30
    const p = payableFor(day(10 / 60, 7.5), [shift('08:00', '16:00')], false)
    expect(p).toMatchObject({ startMin: 8 * 60 + 10, endMin: 15 * 60 + 30, kind: 'shift' })
  })

  it('llegar antes o quedarse despues no suma sin aprobacion', () => {
    // llega 7:40, sale 16:45
    const w = day(-20 / 60, 8.75)
    expect(payableFor(w, [shift('08:00', '16:00')], false)).toMatchObject({ startMin: 480, endMin: 960 })
    expect(outsideMinutes(w, [shift('08:00', '16:00')])).toBe(20 + 45)
  })

  it('con el extra aprobado paga todo lo marcado', () => {
    const p = payableFor(day(-20 / 60, 8.75), [shift('08:00', '16:00')], true)
    expect(p).toMatchObject({ startMin: 7 * 60 + 40, endMin: 16 * 60 + 45, kind: 'approved' })
  })

  it('sin horario paga lo marcado', () => {
    const p = payableFor(day(0, 8), [], false)
    expect(p).toMatchObject({ startMin: 480, endMin: 960, kind: 'no-shift' })
  })

  it('turno nocturno que cruza la medianoche', () => {
    // turno 18:00-02:00, entra 18:00 (offset 10h), sale 02:30 del 23 (offset 18.5h)
    const w = day(10, 18.5, '2026-09-23')
    expect(payableFor(w, [shift('18:00', '02:00')], false)).toMatchObject({ startMin: 18 * 60, endMin: 26 * 60 })
    expect(outsideMinutes(w, [shift('18:00', '02:00')])).toBe(30)
  })

  it('jornada incompleta no se paga (bloquea la descarga)', () => {
    const w = buildWorkdays([punch('in', 0)], LATER)[0]
    expect(payableFor(w, [shift('08:00', '16:00')], false)).toBeNull()
  })

  it('trabajo totalmente fuera del turno sin aprobar: nada', () => {
    expect(payableFor(day(10, 12), [shift('08:00', '12:00')], false)).toBeNull()
  })
})

describe('scheduledPayables', () => {
  it('paga el turno programado completo de quien no marca', () => {
    const shifts = [shift('18:00', '02:00'), { employeeId: 'beto', date: '2026-09-22', start: '08:00', end: '16:00' }]
    const pays = scheduledPayables(shifts, new Set(['ana']))
    expect(pays).toEqual([{ employeeId: 'ana', date: '2026-09-22', startMin: 18 * 60, endMin: 26 * 60, kind: 'scheduled' }])
  })
})

describe('break por marca (espejo de consolidar.py)', () => {
  it('Filipo descuenta 30 min pasadas 6 h; Blue nunca', () => {
    const filipo = breakRuleFor('Filipo')!
    const blue = breakRuleFor('Blue Smash Brgr')!
    expect(breakMinutesFor(7.5 * 60, filipo)).toBe(30)
    expect(breakMinutesFor(6 * 60, filipo)).toBe(0)
    expect(breakMinutesFor(10 * 60, blue)).toBe(0)
    expect(breakRuleFor('Administrativo')).toBeNull()
  })
})

describe('semanas de la quincena', () => {
  it('Q1 y Q2 con sus fechas', () => {
    expect(fortnightRange(2026, 9, 1)).toEqual({ from: '2026-09-01', to: '2026-09-15' })
    expect(fortnightRange(2026, 2, 2)).toEqual({ from: '2026-02-16', to: '2026-02-28' })
  })

  it('incluye las semanas de borde completas', () => {
    // 1-15 sep 2026: el 1 es martes (W36 arranca lun 31-ago), el 15 martes (W38).
    const weeks = isoWeeksCovering('2026-09-01', '2026-09-15')
    expect(weeks.map((w) => w.fileName)).toEqual(['horario-2026-W36', 'horario-2026-W37', 'horario-2026-W38'])
    expect(weeks[0].monday).toBe('2026-08-31')
    expect(weeks[2].dates[6]).toBe('2026-09-20')
  })

  it('numera bien la semana 1 del ano', () => {
    expect(isoWeeksCovering('2026-12-28', '2026-12-31')[0].fileName).toBe('horario-2026-W53')
    expect(isoWeeksCovering('2027-01-04', '2027-01-05')[0].fileName).toBe('horario-2027-W01')
  })
})

describe('buildPayrollWeekSheets', () => {
  const week = isoWeeksCovering('2026-09-21', '2026-09-27')[0]
  const employees = [
    { id: 'ana', name: 'Ana', identification: '111', department: 'Cocina' },
    { id: 'beto', name: 'Beto', identification: '222', department: 'Servicio' },
    { id: 'carla', name: 'Carla', identification: '333', department: 'Servicio' },
  ]

  it('arma la grilla con rangos, novedades y total con break', () => {
    const [grid, novs] = buildPayrollWeekSheets({
      week,
      employees,
      payables: [
        { employeeId: 'ana', date: '2026-09-22', startMin: 15 * 60, endMin: 22 * 60 + 30, kind: 'shift' },
        { employeeId: 'ana', date: '2026-09-27', startMin: 18 * 60, endMin: 26 * 60, kind: 'shift' },
      ],
      novelties: [{ employeeId: 'beto', date: '2026-09-23', typeName: 'Vacaciones', notes: 'x' }],
      rule: breakRuleFor('Filipo')!,
    })
    expect(grid.name).toBe('2026-W39')
    expect(grid.fields.map((f) => f.header).slice(3, 5)).toEqual(['Lun 21', 'Mar 22'])
    const ana = grid.data.find((r) => r.empleado === 'Ana')!
    expect(ana.d1).toBe('3:00 pm – 10:30 pm')
    expect(ana.d6).toBe('6:00 pm – 2:00 am')
    // 7.5 h - 0.5 + 8 h - 0.5 = 14.5 h
    expect(ana.total).toBe('14.5h')
    expect(grid.data.find((r) => r.empleado === 'Beto')!.d2).toBe('Vacaciones')
    expect(grid.data.some((r) => r.empleado === 'Carla')).toBe(false)
    expect(novs.data).toHaveLength(1)
  })

  it('dos jornadas el mismo dia van en la misma celda; el break se mide sobre el dia', () => {
    const [grid] = buildPayrollWeekSheets({
      week,
      employees,
      payables: [
        { employeeId: 'ana', date: '2026-09-22', startMin: 14 * 60, endMin: 18 * 60, kind: 'shift' },
        { employeeId: 'ana', date: '2026-09-22', startMin: 8 * 60, endMin: 11 * 60, kind: 'shift' },
      ],
      novelties: [],
      rule: breakRuleFor('Filipo')!,
    })
    const ana = grid.data[0]
    expect(ana.d1).toBe('8:00 am – 11:00 am / 2:00 pm – 6:00 pm')
    expect(ana.total).toBe('6.5h') // 7 h en el dia - 30 min
  })
})
