import { parseAmountCO, parseDateFlexible, computeStatementId } from './bank-service'

describe('parseAmountCO', () => {
  it('formato Colombia con miles y decimal', () => {
    expect(parseAmountCO('1.234.567,89')).toBe(1234567.89)
  })

  it('formato Colombia solo miles', () => {
    expect(parseAmountCO('1.234.567')).toBe(1234567)
  })

  it('formato US con miles y decimal', () => {
    expect(parseAmountCO('1,234,567.89')).toBe(1234567.89)
  })

  it('con símbolo de moneda y espacios', () => {
    expect(parseAmountCO('$ 1.500.000')).toBe(1500000)
  })

  it('negativo con signo', () => {
    expect(parseAmountCO('-45.000')).toBe(-45000)
  })

  it('negativo entre paréntesis', () => {
    expect(parseAmountCO('(12.300,50)')).toBe(-12300.5)
  })

  it('coma decimal simple', () => {
    expect(parseAmountCO('1234,56')).toBe(1234.56)
  })

  it('punto decimal simple (no grupo de 3)', () => {
    expect(parseAmountCO('1234.5')).toBe(1234.5)
  })

  it('ya es number', () => {
    expect(parseAmountCO(98765.43)).toBe(98765.43)
  })

  it('vacío → NaN', () => {
    expect(Number.isNaN(parseAmountCO(''))).toBe(true)
  })
})

describe('parseDateFlexible', () => {
  it('ISO yyyy-mm-dd', () => {
    expect(parseDateFlexible('2026-05-19')).toBe('2026-05-19')
  })

  it('dd/mm/yyyy (CO día primero)', () => {
    expect(parseDateFlexible('19/05/2026')).toBe('2026-05-19')
  })

  it('dd-mm-yy', () => {
    expect(parseDateFlexible('05-03-26')).toBe('2026-03-05')
  })

  it('detecta día > 12 aunque venga como mm/dd', () => {
    expect(parseDateFlexible('25/04/2026')).toBe('2026-04-25')
  })

  it('texto en español', () => {
    expect(parseDateFlexible('15 ene 2026')).toBe('2026-01-15')
  })

  it('objeto Date', () => {
    expect(parseDateFlexible(new Date(2026, 4, 19))).toBe('2026-05-19')
  })

  it('basura → vacío', () => {
    expect(parseDateFlexible('xxx')).toBe('')
  })
})

describe('computeStatementId', () => {
  it('es determinístico ante mismos inputs', () => {
    const a = computeStatementId('Bancolombia', 'extracto mayo.xlsx', '2026-05-01', '2026-05-31', 120)
    const b = computeStatementId('Bancolombia', 'extracto mayo.xlsx', '2026-05-01', '2026-05-31', 120)
    expect(a).toBe(b)
  })

  it('cambia si cambia el conteo de filas', () => {
    const a = computeStatementId('Bancolombia', 'x.xlsx', '2026-05-01', '2026-05-31', 120)
    const b = computeStatementId('Bancolombia', 'x.xlsx', '2026-05-01', '2026-05-31', 121)
    expect(a).not.toBe(b)
  })
})
