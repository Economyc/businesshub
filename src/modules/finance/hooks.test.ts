import { fakeTimestamp } from '@/test/mocks/firebase'
import { classifyExpense, classifyIncome, calculateNetProfit, calculateRevenue, calculatePendingNet } from './hooks'
import type { Transaction } from './types'

function makeTx(overrides: Partial<Transaction> & Pick<Transaction, 'amount' | 'type' | 'category'>): Transaction {
  return {
    id: 'tx-' + Math.random().toString(36).slice(2),
    concept: 'Test',
    status: 'paid',
    date: fakeTimestamp(new Date('2024-06-15')),
    notes: '',
    createdAt: fakeTimestamp(new Date()),
    updatedAt: fakeTimestamp(new Date()),
    ...overrides,
  }
}

describe('classifyExpense', () => {
  it('"Suministros" → cost_of_sales', () => {
    expect(classifyExpense('Suministros')).toBe('cost_of_sales')
  })

  it('"Insumos" → cost_of_sales', () => {
    expect(classifyExpense('Insumos')).toBe('cost_of_sales')
  })

  it('"Costo de ventas" → cost_of_sales', () => {
    expect(classifyExpense('Costo de ventas')).toBe('cost_of_sales')
  })

  it('"Suministros > Limpieza" → cost_of_sales (via subcategory)', () => {
    expect(classifyExpense('Suministros > Limpieza')).toBe('cost_of_sales')
  })

  it('"Nómina" → operating', () => {
    expect(classifyExpense('Nómina')).toBe('operating')
  })

  it('"Alquiler" → operating', () => {
    expect(classifyExpense('Alquiler')).toBe('operating')
  })

  it('"Impuestos" → other_expense', () => {
    expect(classifyExpense('Impuestos')).toBe('other_expense')
  })

  it('"Seguros" → other_expense', () => {
    expect(classifyExpense('Seguros')).toBe('other_expense')
  })

  it('handles accented chars correctly', () => {
    expect(classifyExpense('Nómina > Salarios')).toBe('operating')
  })
})

describe('classifyIncome', () => {
  it('"Ventas" → revenue', () => {
    expect(classifyIncome('Ventas')).toBe('revenue')
  })

  it('"Propinas" → other_income', () => {
    expect(classifyIncome('Propinas')).toBe('other_income')
  })

  it('"Otros" → other_income', () => {
    expect(classifyIncome('Otros')).toBe('other_income')
  })

  it('"Ventas > Productos" → revenue', () => {
    expect(classifyIncome('Ventas > Productos')).toBe('revenue')
  })
})

describe('calculateNetProfit', () => {
  it('correctly computes: revenue - COGS - operating + otherIncome - otherExpenses', () => {
    const txs: Transaction[] = [
      makeTx({ amount: 1000, type: 'income', category: 'Ventas' }),         // revenue
      makeTx({ amount: 200, type: 'income', category: 'Propinas' }),        // other_income
      makeTx({ amount: 300, type: 'expense', category: 'Suministros' }),    // cost_of_sales
      makeTx({ amount: 150, type: 'expense', category: 'Nómina' }),         // operating
      makeTx({ amount: 50, type: 'expense', category: 'Impuestos' }),       // other_expense
    ]
    // 1000 - 300 - 150 + 200 - 50 = 700
    expect(calculateNetProfit(txs)).toBe(700)
  })

  it('returns 0 for empty array', () => {
    expect(calculateNetProfit([])).toBe(0)
  })
})

describe('calculateRevenue', () => {
  it('sums only income classified as "revenue"', () => {
    const txs: Transaction[] = [
      makeTx({ amount: 500, type: 'income', category: 'Ventas' }),
      makeTx({ amount: 300, type: 'income', category: 'Ventas > Productos' }),
      makeTx({ amount: 100, type: 'income', category: 'Propinas' }),  // other_income - excluded
    ]
    expect(calculateRevenue(txs)).toBe(800)
  })

  it('returns 0 when no revenue transactions', () => {
    const txs: Transaction[] = [
      makeTx({ amount: 100, type: 'expense', category: 'Nómina' }),
    ]
    expect(calculateRevenue(txs)).toBe(0)
  })
})

describe('calculatePendingNet', () => {
  it('sums pending/overdue income minus pending/overdue expenses', () => {
    const txs: Transaction[] = [
      makeTx({ amount: 500, type: 'income', category: 'Ventas', status: 'pending' }),
      makeTx({ amount: 200, type: 'expense', category: 'Nómina', status: 'overdue' }),
      makeTx({ amount: 1000, type: 'income', category: 'Ventas', status: 'paid' }),  // ignored
    ]
    expect(calculatePendingNet(txs)).toBe(300)
  })

  it('ignores "paid" transactions', () => {
    const txs: Transaction[] = [
      makeTx({ amount: 500, type: 'income', category: 'Ventas', status: 'paid' }),
      makeTx({ amount: 200, type: 'expense', category: 'Nómina', status: 'paid' }),
    ]
    expect(calculatePendingNet(txs)).toBe(0)
  })

  it('returns 0 for empty array', () => {
    expect(calculatePendingNet([])).toBe(0)
  })
})
