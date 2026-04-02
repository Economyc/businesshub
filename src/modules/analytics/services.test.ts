import { getCostGroup, formatPercentage, calcChange, getMonthsBetween, MONTH_LABELS } from './services'

describe('getCostGroup', () => {
  it('returns "operativo" for Nómina', () => {
    expect(getCostGroup('Nómina')).toBe('operativo')
  })

  it('returns "operativo" for Servicios', () => {
    expect(getCostGroup('Servicios')).toBe('operativo')
  })

  it('returns "operativo" for Alquiler', () => {
    expect(getCostGroup('Alquiler')).toBe('operativo')
  })

  it('returns "obligaciones" for Impuestos', () => {
    expect(getCostGroup('Impuestos')).toBe('obligaciones')
  })

  it('returns "obligaciones" for Seguros', () => {
    expect(getCostGroup('Seguros')).toBe('obligaciones')
  })

  it('returns "otros" for unknown categories', () => {
    expect(getCostGroup('Tecnología')).toBe('otros')
  })

  it('handles subcategories via startsWith', () => {
    expect(getCostGroup('Nómina > Salarios')).toBe('operativo')
    expect(getCostGroup('Impuestos > IVA')).toBe('obligaciones')
  })
})

describe('formatPercentage', () => {
  it('formats number as percentage string', () => {
    expect(formatPercentage(25.678)).toBe('25.7%')
  })

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0.0%')
  })
})

describe('calcChange', () => {
  it('returns "+100%" when previous is 0 and current > 0', () => {
    expect(calcChange(500, 0)).toBe('+100%')
  })

  it('returns "0%" when both are 0', () => {
    expect(calcChange(0, 0)).toBe('0%')
  })

  it('returns correct positive change', () => {
    expect(calcChange(150, 100)).toBe('+50.0%')
  })

  it('returns correct negative change', () => {
    expect(calcChange(75, 100)).toBe('-25.0%')
  })
})

describe('getMonthsBetween', () => {
  it('returns single month for same-month range', () => {
    const result = getMonthsBetween(new Date(2024, 5, 1), new Date(2024, 5, 30))
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Jun')
  })

  it('returns correct months for multi-month range', () => {
    const result = getMonthsBetween(new Date(2024, 0, 1), new Date(2024, 2, 31))
    expect(result).toHaveLength(3)
    expect(result.map((m) => m.label)).toEqual(['Ene', 'Feb', 'Mar'])
  })

  it('uses Spanish month abbreviations', () => {
    for (let i = 0; i < 12; i++) {
      expect(MONTH_LABELS[i]).toBeTruthy()
    }
    expect(MONTH_LABELS[0]).toBe('Ene')
    expect(MONTH_LABELS[11]).toBe('Dic')
  })
})
