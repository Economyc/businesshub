import { describe, expect, it } from 'vitest'
import { decidePunch, nextPunchType, type ScheduledShift } from '../../../functions/src/attendance/match'

// Hora de Colombia -> ms.
const t = (local: string) => Date.parse(`${local}:00-05:00`)
const inAt = (local: string) => ({ type: 'in' as const, atMs: t(local) })
const shift = (date: string, start: string, end: string): ScheduledShift => ({ date, start, end })

describe('nextPunchType', () => {
  it('sin marcaciones previas es entrada', () => {
    expect(nextPunchType(null, t('2026-10-06T08:00'))).toBe('in')
  })

  it('despues de una salida es entrada', () => {
    expect(nextPunchType({ type: 'out', atMs: t('2026-10-06T08:00') }, t('2026-10-06T09:00'))).toBe('in')
  })

  it('entrada y salida el mismo dia', () => {
    expect(nextPunchType(inAt('2026-10-06T08:00'), t('2026-10-06T16:00'))).toBe('out')
  })

  it('olvido la salida ayer en la tarde y hoy llega a su turno: entrada', () => {
    const shifts = [shift('2026-10-05', '17:00', '23:00'), shift('2026-10-06', '10:00', '18:00')]
    expect(nextPunchType(inAt('2026-10-05T17:00'), t('2026-10-06T10:00'), shifts)).toBe('in')
  })

  it('mismo caso sin horario: pasado el corte de las 6 am es entrada', () => {
    expect(nextPunchType(inAt('2026-10-05T17:00'), t('2026-10-06T10:00'))).toBe('in')
  })

  it('turno que cruza la medianoche cierra en la madrugada', () => {
    const shifts = [shift('2026-10-05', '18:00', '01:00')]
    expect(nextPunchType(inAt('2026-10-05T18:00'), t('2026-10-06T01:30'), shifts)).toBe('out')
  })

  it('con turno, pasada la gracia despues del fin ya no cierra', () => {
    const shifts = [shift('2026-10-05', '12:00', '20:00')]
    expect(nextPunchType(inAt('2026-10-05T12:00'), t('2026-10-06T00:30'), shifts)).toBe('in')
  })

  it('sin horario, entrada de noche cierra antes del corte', () => {
    expect(nextPunchType(inAt('2026-10-05T22:00'), t('2026-10-06T03:00'))).toBe('out')
  })

  it('nunca cierra una entrada de mas de 18 h', () => {
    const shifts = [shift('2026-10-05', '06:00', '05:00')]
    expect(nextPunchType(inAt('2026-10-05T06:00'), t('2026-10-06T01:00'), shifts)).toBe('in')
  })

  describe('salida sin entrada', () => {
    const shifts = [shift('2026-10-06', '10:00', '18:00')]

    it('olvido marcar al llegar y marca al final del turno: salida', () => {
      expect(decidePunch(null, t('2026-10-06T18:05'), shifts)).toEqual({ type: 'out', missedIn: true })
    })

    it('tambien si quedo abierta una entrada de ayer', () => {
      expect(decidePunch(inAt('2026-10-05T17:00'), t('2026-10-06T18:05'), shifts)).toEqual({ type: 'out', missedIn: true })
    })

    it('si ya marco algo en este turno no adivina salida sin entrada', () => {
      const lastOut = { type: 'out' as const, atMs: t('2026-10-06T14:00') }
      expect(nextPunchType(lastOut, t('2026-10-06T17:30'), shifts)).toBe('in')
    })

    it('al inicio del turno es entrada', () => {
      expect(nextPunchType(null, t('2026-10-06T09:50'), shifts)).toBe('in')
    })

    it('antes de la mitad del turno es entrada (llego tarde)', () => {
      const short = [shift('2026-10-06', '10:00', '13:00')]
      expect(nextPunchType(null, t('2026-10-06T11:20'), short)).toBe('in')
    })

    it('sin horario no puede saberlo: entrada', () => {
      expect(nextPunchType(null, t('2026-10-06T18:05'))).toBe('in')
    })

    it('turno partido: al final del primero es salida, al empezar el segundo entrada', () => {
      const split = [shift('2026-10-06', '08:00', '12:00'), shift('2026-10-06', '16:00', '20:00')]
      expect(nextPunchType(null, t('2026-10-06T12:00'), split)).toBe('out')
      expect(nextPunchType({ type: 'out', atMs: t('2026-10-06T12:00') }, t('2026-10-06T16:00'), split)).toBe('in')
    })
  })
})
