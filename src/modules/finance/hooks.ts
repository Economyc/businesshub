import { useMemo } from 'react'
import { useCollection } from '@/core/hooks/use-firestore'
import type { Transaction } from './types'

export function useTransactions() {
  return useCollection<Transaction>('transactions')
}

export function useFinanceSummary() {
  const { data: transactions, loading } = useTransactions()

  const summary = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expenses, balance: income - expenses }
  }, [transactions])

  return { summary, loading }
}
