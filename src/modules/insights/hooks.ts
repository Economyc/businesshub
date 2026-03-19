import { useMemo } from 'react'
import { useCollection } from '@/core/hooks/use-firestore'
import { MONTH_LABELS } from './services'
import type { KPIData, TrendPoint, CategoryData } from './types'
import type { Employee } from '@/modules/talent/types'
import type { Supplier } from '@/modules/suppliers/types'
import type { Transaction } from '@/modules/finance/types'

export function useKPIs(): { kpis: KPIData; loading: boolean } {
  const { data: employees, loading: empLoading } = useCollection<Employee>('employees')
  const { data: suppliers, loading: supLoading } = useCollection<Supplier>('suppliers')
  const { data: transactions, loading: txLoading } = useCollection<Transaction>('transactions')

  const loading = empLoading || supLoading || txLoading

  const kpis = useMemo<KPIData>(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

    const activeEmployees = employees.filter((e) => e.status === 'active')
    const activeSuppliers = suppliers.filter((s) => s.status === 'active')

    const incomeTransactions = transactions.filter((t) => t.type === 'income')
    const expenseTransactions = transactions.filter((t) => t.type === 'expense')

    const totalIncome = incomeTransactions.reduce((s, t) => s + t.amount, 0)
    const totalExpenses = expenseTransactions.reduce((s, t) => s + t.amount, 0)
    const balance = totalIncome - totalExpenses

    // Monthly comparisons
    const isThisMonth = (t: Transaction) => {
      const d = t.date?.toDate?.() ?? new Date(0)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    }
    const isLastMonth = (t: Transaction) => {
      const d = t.date?.toDate?.() ?? new Date(0)
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
    }

    const thisMonthExpenses = expenseTransactions.filter(isThisMonth).reduce((s, t) => s + t.amount, 0)
    const lastMonthExpenses = expenseTransactions.filter(isLastMonth).reduce((s, t) => s + t.amount, 0)
    const thisMonthBalance = transactions.filter(isThisMonth).reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0)

    const expenseDiff = thisMonthExpenses - lastMonthExpenses
    const expenseChangeStr = expenseDiff >= 0
      ? `+$${expenseDiff.toLocaleString('en-US')} este mes`
      : `-$${Math.abs(expenseDiff).toLocaleString('en-US')} este mes`

    const balanceChangeStr = thisMonthBalance >= 0
      ? `+$${thisMonthBalance.toLocaleString('en-US')} este mes`
      : `-$${Math.abs(thisMonthBalance).toLocaleString('en-US')} este mes`

    return {
      totalEmployees: activeEmployees.length,
      totalSuppliers: activeSuppliers.length,
      totalIncome,
      totalExpenses,
      balance,
      employeeChange: `${activeEmployees.length} activos`,
      supplierChange: `${activeSuppliers.length} activos`,
      expenseChange: expenseChangeStr,
      balanceChange: balanceChangeStr,
    }
  }, [employees, suppliers, transactions])

  return { kpis, loading }
}

export function useTrends(): { trends: TrendPoint[]; loading: boolean } {
  const { data: transactions, loading } = useCollection<Transaction>('transactions')

  const trends = useMemo<TrendPoint[]>(() => {
    const now = new Date()
    const months: TrendPoint[] = []

    // Build last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`
      months.push({
        month: MONTH_LABELS[d.getMonth()],
        income: 0,
        expenses: 0,
        // store key temporarily — we'll remove after grouping
        ...({ _key: monthKey } as any),
      })
    }

    const monthMap: Record<string, TrendPoint> = {}
    months.forEach((m: any) => {
      monthMap[m._key] = m
    })

    transactions.forEach((t) => {
      const d = t.date?.toDate?.() ?? new Date(0)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (monthMap[key]) {
        if (t.type === 'income') {
          monthMap[key].income += t.amount
        } else {
          monthMap[key].expenses += t.amount
        }
      }
    })

    // Strip internal _key before returning
    return months.map(({ _key: _k, ...rest }: any) => rest as TrendPoint)
  }, [transactions])

  return { trends, loading }
}

export function useCategoryBreakdown(): { categories: CategoryData[]; loading: boolean } {
  const { data: transactions, loading } = useCollection<Transaction>('transactions')

  const categories = useMemo<CategoryData[]>(() => {
    const expensesByCategory: Record<string, number> = {}

    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        expensesByCategory[t.category] = (expensesByCategory[t.category] ?? 0) + t.amount
      })

    return Object.entries(expensesByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions])

  return { categories, loading }
}
