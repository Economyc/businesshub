import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { fetchCollection } from '@/core/firebase/helpers'
import type { Company } from '@/core/types'
import type { Employee } from '@/modules/talent/types'
import type { Supplier } from '@/modules/suppliers/types'
import type { Transaction } from '@/modules/finance/types'
import { calculateNetProfit, calculateRevenue, calculatePendingNet } from '@/modules/finance/hooks'

export interface CompanySummary {
  company: Company
  monthlyIncome: number
  monthlyExpenses: number
  monthlyNetProfit: number
  profitMargin: number
  incomeChange: number | null
  expenseChange: number | null
  profitChange: number | null
  activeEmployees: number
  activeSuppliers: number
  pendingNet: number
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function filterByDateRange(transactions: Transaction[], start: Date, end: Date): Transaction[] {
  return transactions.filter((t) => {
    const d = t.date?.toDate?.()
    return d && d >= start && d <= end
  })
}

async function loadCompanySummaries(companies: Company[]): Promise<CompanySummary[]> {
  return Promise.all(
    companies.map(async (company) => {
      const [employees, suppliers, transactions] = await Promise.all([
        fetchCollection<Employee>(company.id, 'employees'),
        fetchCollection<Supplier>(company.id, 'suppliers'),
        fetchCollection<Transaction>(company.id, 'transactions'),
      ])

      const activeEmployees = employees.filter((e) => e.status === 'active').length
      const activeSuppliers = suppliers.filter((s) => s.status === 'active').length

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

      const currentTxs = filterByDateRange(transactions, monthStart, monthEnd)
      const prevTxs = filterByDateRange(transactions, prevMonthStart, prevMonthEnd)

      const monthlyIncome = currentTxs
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0)
      const monthlyExpenses = currentTxs
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)
      const monthlyNetProfit = calculateNetProfit(currentTxs)
      const revenue = calculateRevenue(currentTxs)
      const profitMargin = revenue > 0 ? (monthlyNetProfit / revenue) * 100 : 0

      const prevIncome = prevTxs
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0)
      const prevExpenses = prevTxs
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)
      const prevNetProfit = calculateNetProfit(prevTxs)

      const pendingNet = calculatePendingNet(transactions)

      return {
        company,
        monthlyIncome,
        monthlyExpenses,
        monthlyNetProfit,
        profitMargin,
        incomeChange: percentChange(monthlyIncome, prevIncome),
        expenseChange: percentChange(monthlyExpenses, prevExpenses),
        profitChange: percentChange(monthlyNetProfit, prevNetProfit),
        activeEmployees,
        activeSuppliers,
        pendingNet,
      }
    })
  )
}

export function useCompanySummaries() {
  const { companies } = useCompany()

  const { data: summaries, isLoading: loading } = useQuery({
    queryKey: ['home', 'summaries', companies.map((c) => c.id).join(',')],
    queryFn: () => loadCompanySummaries(companies),
    enabled: companies.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  return { summaries: summaries ?? [], loading }
}
