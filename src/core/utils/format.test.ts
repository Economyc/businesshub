import { formatCurrency, formatPercentChange } from './format'

describe('formatCurrency', () => {
  it('formats 0 as "$0"', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('formats large numbers with thousand separators', () => {
    const result = formatCurrency(1000000)
    // es-CO uses period as thousand separator
    expect(result).toMatch(/^\$1[\.,]000[\.,]000$/)
  })

  it('respects decimals parameter', () => {
    const result = formatCurrency(1234.5, 2)
    // es-CO uses period as thousand separator: $1.234,50
    expect(result).toMatch(/1\.?234/)
    expect(result).toContain('50')
  })

  it('handles negative numbers', () => {
    const result = formatCurrency(-500)
    expect(result).toContain('500')
  })
})

describe('formatPercentChange', () => {
  it('returns "--" for null', () => {
    expect(formatPercentChange(null)).toBe('--')
  })

  it('returns "+X.X%" for positive values', () => {
    expect(formatPercentChange(5.25)).toBe('+5.3%')
  })

  it('returns "-X.X%" for negative values', () => {
    expect(formatPercentChange(-3.7)).toBe('-3.7%')
  })

  it('returns "+0.0%" for zero', () => {
    expect(formatPercentChange(0)).toBe('+0.0%')
  })
})
