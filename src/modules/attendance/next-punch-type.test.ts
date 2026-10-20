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

  it('con turno, quien se queda hasta el cierre sale bien aunque pase la gracia', () => {
    const shifts = [shift('2026-10-05', '12:00', '20:00')]
    expect(nextPunchType(inAt('2026-10-05T12:00'), t('2026-10-06T00:30'), shifts)).toBe('out')
  })

  it('doble turno: entra 11:02 con turno 11-16 y sale 22:17', () => {
    const shifts = [shift('2026-10-12', '11:00', '16:00')]
    expect(nextPunchType(inAt('2026-10-12T11:02'), t('2026-10-12T22:17'), shifts)).toBe('out')
  })

  it('horas extra: entra 11:10 con turno 11-18 y sale 22:44', () => {
    const shifts = [shift('2026-10-07', '11:00', '18:00')]
    expect(nextPunchType(inAt('2026-10-07T11:10'), t('2026-10-07T22:44'), shifts)).toBe('out')
  })

  it('un turno que termina despues del corte alarga la vigencia', () => {
    const shifts = [shift('2026-10-05', '22:00', '06:00')]
    expect(nextPunchType(inAt('2026-10-05T22:00'), t('2026-10-06T07:30'), shifts)).toBe('out')
  })

  it('entrada de ayer sin salida y hoy llega sin turno en Horarios: entrada', () => {
    expect(nextPunchType(inAt('2026-10-09T15:12'), t('2026-10-10T16:00'))).toBe('in')
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

    it('llega tarde a las 4 pm con turno 11-18: entrada, no salida sin entrada', () => {
      const s = [shift('2026-10-11', '11:00', '18:00')]
      const lastOut = { type: 'out' as const, atMs: t('2026-10-10T22:57') }
      expect(nextPunchType(lastOut, t('2026-10-11T16:08'), s)).toBe('in')
      expect(nextPunchType(lastOut, t('2026-10-11T16:24'), s)).toBe('in')
    })

    it('llega a las 4 pm a un turno de tarde aunque otro turno suyo termine a esa hora', () => {
      const s = [shift('2026-10-10', '09:00', '16:00'), shift('2026-10-10', '16:00', '23:00')]
      expect(nextPunchType(null, t('2026-10-10T16:00'), s)).toBe('in')
    })

    it('olvido entrar y sale al cierre: salida sin entrada (casos reales)', () => {
      const lastOutYesterday = { type: 'out' as const, atMs: t('2026-10-11T23:44') }
      expect(decidePunch(lastOutYesterday, t('2026-10-12T23:02'), [shift('2026-10-12', '16:00', '23:00')]))
        .toEqual({ type: 'out', missedIn: true })
      expect(decidePunch(null, t('2026-10-12T15:04'), [shift('2026-10-12', '11:00', '15:00')]))
        .toEqual({ type: 'out', missedIn: true })
      expect(decidePunch(null, t('2026-10-10T16:14'), [shift('2026-10-10', '09:00', '16:00')]))
        .toEqual({ type: 'out', missedIn: true })
    })

    it('una hora antes del fin todavia no adivina salida', () => {
      expect(nextPunchType(null, t('2026-10-06T17:00'), shifts)).toBe('in')
    })

    it('turno partido: al final del primero es salida, al empezar el segundo entrada', () => {
      const split = [shift('2026-10-06', '08:00', '12:00'), shift('2026-10-06', '16:00', '20:00')]
      expect(nextPunchType(null, t('2026-10-06T12:00'), split)).toBe('out')
      expect(nextPunchType({ type: 'out', atMs: t('2026-10-06T12:00') }, t('2026-10-06T16:00'), split)).toBe('in')
    })
  })

  describe('salida sin entrada que era la llegada', () => {
    const missedOut = (local: string) => ({ type: 'out' as const, atMs: t(local), missedIn: true })

    it('Horarios 9-16 pero llego a las 15:56 y sale 22:43: reclasifica (caso real)', () => {
      const s = [shift('2026-10-19', '09:00', '16:00')]
      expect(decidePunch(null, t('2026-10-19T15:56'), s)).toEqual({ type: 'out', missedIn: true })
      expect(decidePunch(missedOut('2026-10-19T15:56'), t('2026-10-19T22:43'), s))
        .toEqual({ type: 'out', missedIn: false, reclassifyLast: true })
    })

    it('si sale despues de medianoche igual reclasifica', () => {
      const s = [shift('2026-10-19', '09:00', '16:00')]
      expect(decidePunch(missedOut('2026-10-19T15:56'), t('2026-10-20T00:30'), s).reclassifyLast).toBe(true)
    })

    it('menos de 2 h despues no reclasifica', () => {
      const s = [shift('2026-10-19', '09:00', '16:00')]
      expect(decidePunch(missedOut('2026-10-19T15:56'), t('2026-10-19T17:30'), s).reclassifyLast).toBeUndefined()
    })

    it('si llega a un turno de hoy es entrada nueva, no reclasifica', () => {
      const s = [shift('2026-10-19', '09:00', '16:00'), shift('2026-10-19', '19:00', '23:00')]
      expect(decidePunch(missedOut('2026-10-19T15:56'), t('2026-10-19T19:05'), s))
        .toEqual({ type: 'in', missedIn: false })
    })

    it('al dia siguiente es entrada, no reclasifica', () => {
      const s = [shift('2026-10-19', '09:00', '16:00')]
      expect(decidePunch(missedOut('2026-10-19T15:56'), t('2026-10-20T09:02'), s))
        .toEqual({ type: 'in', missedIn: false })
    })

    it('una salida normal (sin missedIn) no se toca', () => {
      expect(decidePunch({ type: 'out', atMs: t('2026-10-19T15:56') }, t('2026-10-19T22:43')))
        .toEqual({ type: 'in', missedIn: false })
    })
  })
})
