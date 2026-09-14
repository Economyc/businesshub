import {
  enumerateDays,
  formatHourBand,
  formatTime12,
  formatPeriodLabel,
  isFullMonth,
  periodLength,
  periodSlug,
  previousPeriod,
  weekBuckets,
  weekdayIndexMondayFirst,
} from './period'

describe('previousPeriod', () => {
  it('compara un mes completo con el mes anterior completo', () => {
    expect(previousPeriod({ start: '2026-08-01', end: '2026-08-31' })).toEqual({ start: '2026-07-01', end: '2026-07-31' })
  })

  it('marzo se compara con febrero aunque tenga 28 días', () => {
    expect(previousPeriod({ start: '2026-03-01', end: '2026-03-31' })).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('enero se compara con diciembre del año anterior', () => {
    expect(previousPeriod({ start: '2026-01-01', end: '2026-01-31' })).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })

  it('un rango parcial se compara con uno de igual duración justo antes', () => {
    expect(previousPeriod({ start: '2026-09-01', end: '2026-09-14' })).toEqual({ start: '2026-08-18', end: '2026-08-31' })
  })
})

describe('periodos', () => {
  it('cuenta los días incluyendo ambos extremos', () => {
    expect(periodLength({ start: '2026-08-01', end: '2026-08-31' })).toBe(31)
    expect(enumerateDays({ start: '2026-02-27', end: '2026-03-02' })).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })

  it('reconoce el mes completo', () => {
    expect(isFullMonth({ start: '2028-02-01', end: '2028-02-29' })).toBe(true)
    expect(isFullMonth({ start: '2026-08-01', end: '2026-08-30' })).toBe(false)
  })

  it('arma bloques de 7 días con el último más corto', () => {
    const weeks = weekBuckets({ start: '2026-08-01', end: '2026-08-31' })
    expect(weeks.map((w) => w.label)).toEqual(['1 al 7 ago', '8 al 14 ago', '15 al 21 ago', '22 al 28 ago', '29 al 31 ago'])
  })

  it('etiqueta semanas que cruzan de mes', () => {
    expect(weekBuckets({ start: '2026-08-29', end: '2026-09-04' })[0].label).toBe('29 ago al 4 sep')
  })

  it('lunes es 0 y domingo es 6', () => {
    expect(weekdayIndexMondayFirst('2026-08-03')).toBe(0) // lunes
    expect(weekdayIndexMondayFirst('2026-08-02')).toBe(6) // domingo
  })

  it('escribe horas en formato de 12 horas', () => {
    expect(formatTime12('18:05')).toBe('6:05 p. m.')
    expect(formatTime12('12:15')).toBe('12:15 p. m.')
    expect(formatTime12('00:30')).toBe('12:30 a. m.')
    expect(formatTime12('09:00')).toBe('9:00 a. m.')
    expect(formatTime12('')).toBe('')
    expect(formatHourBand(11)).toBe('11:00 – 11:59 a. m.')
    expect(formatHourBand(12)).toBe('12:00 – 12:59 p. m.')
    expect(formatHourBand(0)).toBe('12:00 – 12:59 a. m.')
  })

  it('nombra archivos y periodos', () => {
    expect(periodSlug({ start: '2026-08-01', end: '2026-08-31' })).toBe('2026-08')
    expect(periodSlug({ start: '2026-08-01', end: '2026-08-15' })).toBe('2026-08-01_a_2026-08-15')
    expect(formatPeriodLabel({ start: '2026-08-01', end: '2026-08-31' })).toBe('agosto de 2026')
    expect(formatPeriodLabel({ start: '2026-08-01', end: '2026-08-15' })).toBe('1 al 15 de agosto de 2026')
  })
})
