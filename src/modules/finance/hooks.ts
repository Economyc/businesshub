import { useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy, where, Timestamp } from 'firebase/firestore'
import { useCompany } from '@/core/hooks/use-company'
import { queryClient } from '@/core/query/query-client'
import { fetchCollection } from '@/core/firebase/helpers'
import { budgetService, bankStatementService } from './services'
import { generatePendingTransactions } from './recurring-generator'
import { autoMatch } from './utils/reconciliation-matcher'
import type { Transaction, RecurringTransaction, BudgetItem, BankStatement, BankStatementFormData, ReconciliationMatch } from './types'

export function useTransactions() {
  return useCollection<Transaction>('transactions')
}

export function usePaginatedTransactions() {
  return usePaginatedCollection<Transaction>('transactions', 50, orderBy('date', 'desc'))
}

// Hook que solo trae las transacciones del rango [start, end].
// Sustituye el patrón "leer toda la colección y filtrar in-memory" en las
// vistas que ya tienen un DateRangePicker (Cash Flow, Income Statement,
// Budget, Finance Summary). Con miles de transacciones esto pasa de bajar
// 5-10 MB cada vez a bajar solo lo del período.
export function useTransactionsInRange(startDate: Date, endDate: Date) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'transactions', 'range', startMs, endMs],
    queryFn: () =>
      fetchCollection<Transaction>(
        companyId!,
        'transactions',
        where('date', '>=', Timestamp.fromMillis(startMs)),
        where('date', '<=', Timestamp.fromMillis(endMs)),
      ),
    enabled: !!companyId,
  })

  return {
    data: data ?? [],
    loading: isLoading,
    error: error as Error | null,
    refetch,
  }
}

// Variante que trae todo hasta `endDate` (incluido). Necesario para Cash Flow,
// que debe calcular saldo de apertura sumando transacciones anteriores al
// período. Aún así reduce volumen vs leer la colección entera si el rango
// está cerca del presente.
export function useTransactionsUntil(endDate: Date) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const endMs = endDate.getTime()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'transactions', 'until', endMs],
    queryFn: () =>
      fetchCollection<Transaction>(
        companyId!,
        'transactions',
        where('date', '<=', Timestamp.fromMillis(endMs)),
      ),
    enabled: !!companyId,
  })

  return {
    data: data ?? [],
    loading: isLoading,
    error: error as Error | null,
    refetch,
  }
}

export function useRecurringTransactions() {
  return useCollection<RecurringTransaction>('recurring-transactions')
}

export function useRecurringGenerator() {
  const { selectedCompany } = useCompany()
  const { refetch } = useTransactions()
  const ran = useRef(false)

  useEffect(() => {
    if (!selectedCompany || ran.current) return
    ran.current = true
    generatePendingTransactions(selectedCompany.id).then((count) => {
      if (count > 0) refetch()
    })
  }, [selectedCompany?.id])
}

export function useFinanceSummary(startDate: Date, endDate: Date) {
  // Solo trae el rango — Firestore filtra por índice, el navegador no recibe
  // las transacciones fuera del período.
  const { data: transactions, loading } = useTransactionsInRange(startDate, endDate)

  const summary = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expenses, balance: income - expenses }
  }, [transactions])

  return { summary, loading }
}

export interface CategoryBreakdown {
  category: string
  total: number
  transactions: Transaction[]
}

export interface CashFlowData {
  openingBalance: number
  totalIncome: number
  totalExpenses: number
  netFlow: number
  closingBalance: number
  incomeByCategory: CategoryBreakdown[]
  expensesByCategory: CategoryBreakdown[]
  pendingIncome: number
  pendingExpenses: number
  pendingCount: number
}

export function useCashFlow(startDate: Date, endDate: Date) {
  // Trae todo hasta endDate. Necesitamos las anteriores al período para
  // calcular el saldo de apertura, así que no podemos limitarnos al rango.
  // Aún así, recorta toda la historia futura al endDate.
  const { data: transactions, loading } = useTransactionsUntil(endDate)

  const cashFlow = useMemo<CashFlowData>(() => {
    const periodStart = startDate
    const periodEnd = endDate

    const paid = transactions.filter((t) => t.status === 'paid')
    const beforePeriod = paid.filter((t) => {
      const d = t.date?.toDate?.()
      return d && d < periodStart
    })
    const openingBalance = beforePeriod.reduce(
      (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
      0
    )

    const inPeriod = (t: Transaction) => {
      const d = t.date?.toDate?.()
      return d && d >= periodStart && d <= periodEnd
    }

    const periodPaid = paid.filter(inPeriod)
    const periodPending = transactions.filter(
      (t) => (t.status === 'pending' || t.status === 'overdue') && inPeriod(t)
    )

    const groupByCategory = (txs: Transaction[]): CategoryBreakdown[] => {
      const map = new Map<string, Transaction[]>()
      for (const t of txs) {
        const cat = t.category || 'Sin categoría'
        if (!map.has(cat)) map.set(cat, [])
        map.get(cat)!.push(t)
      }
      return Array.from(map.entries())
        .map(([category, transactions]) => ({
          category,
          total: transactions.reduce((s, t) => s + t.amount, 0),
          transactions,
        }))
        .sort((a, b) => b.total - a.total)
    }

    const incomeTxs = periodPaid.filter((t) => t.type === 'income')
    const expenseTxs = periodPaid.filter((t) => t.type === 'expense')

    const totalIncome = incomeTxs.reduce((s, t) => s + t.amount, 0)
    const totalExpenses = expenseTxs.reduce((s, t) => s + t.amount, 0)
    const netFlow = totalIncome - totalExpenses

    const pendingIncome = periodPending
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const pendingExpenses = periodPending
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    return {
      openingBalance,
      totalIncome,
      totalExpenses,
      netFlow,
      closingBalance: openingBalance + netFlow,
      incomeByCategory: groupByCategory(incomeTxs),
      expensesByCategory: groupByCategory(expenseTxs),
      pendingIncome,
      pendingExpenses,
      pendingCount: periodPending.length,
    }
  }, [transactions, startDate.getTime(), endDate.getTime()])

  return { cashFlow, loading }
}

export interface IncomeStatementSection {
  label: string
  categories: CategoryBreakdown[]
  total: number
}

export interface IncomeStatementData {
  revenue: IncomeStatementSection
  costOfSales: IncomeStatementSection
  grossProfit: number
  grossMargin: number
  operatingExpenses: IncomeStatementSection
  operatingProfit: number
  operatingMargin: number
  otherIncome: IncomeStatementSection
  otherExpenses: IncomeStatementSection
  netProfit: number
  netMargin: number
  transactionCount: number
}

const COST_OF_SALES_CATS = ['suministros', 'insumos', 'costo de ventas']
const OTHER_INCOME_CATS = ['otros', 'propinas']
const OTHER_EXPENSE_CATS = ['impuestos', 'seguros', 'otros']

function normalizeCat(category: string): string {
  return category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(' > ')[0]
    .trim()
}

export function classifyExpense(category: string): 'cost_of_sales' | 'operating' | 'other_expense' {
  const norm = normalizeCat(category)
  if (COST_OF_SALES_CATS.some((c) => norm.includes(c))) return 'cost_of_sales'
  if (OTHER_EXPENSE_CATS.some((c) => norm === c)) return 'other_expense'
  return 'operating'
}

export function classifyIncome(category: string): 'revenue' | 'other_income' {
  const norm = normalizeCat(category)
  if (OTHER_INCOME_CATS.some((c) => norm === c)) return 'other_income'
  return 'revenue'
}

export function calculateNetProfit(transactions: Transaction[]): number {
  const incomeTxs = transactions.filter((t) => t.type === 'income')
  const expenseTxs = transactions.filter((t) => t.type === 'expense')

  let revenue = 0, otherIncome = 0
  for (const t of incomeTxs) {
    if (classifyIncome(t.category) === 'other_income') otherIncome += t.amount
    else revenue += t.amount
  }

  let costOfSales = 0, operatingExp = 0, otherExp = 0
  for (const t of expenseTxs) {
    const cls = classifyExpense(t.category)
    if (cls === 'cost_of_sales') costOfSales += t.amount
    else if (cls === 'other_expense') otherExp += t.amount
    else operatingExp += t.amount
  }

  return revenue - costOfSales - operatingExp + otherIncome - otherExp
}

export function calculateRevenue(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'income' && classifyIncome(t.category) === 'revenue')
    .reduce((sum, t) => sum + t.amount, 0)
}

export function calculatePendingNet(transactions: Transaction[]): number {
  const pending = transactions.filter((t) => t.status === 'pending' || t.status === 'overdue')
  const pendingIncome = pending.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const pendingExpenses = pending.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  return pendingIncome - pendingExpenses
}

function buildSection(label: string, txs: Transaction[]): IncomeStatementSection {
  const map = new Map<string, Transaction[]>()
  for (const t of txs) {
    const cat = t.category || 'Sin categoría'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(t)
  }
  const categories = Array.from(map.entries())
    .map(([category, transactions]) => ({
      category,
      total: transactions.reduce((s, t) => s + t.amount, 0),
      transactions,
    }))
    .sort((a, b) => b.total - a.total)
  return { label, categories, total: txs.reduce((s, t) => s + t.amount, 0) }
}

export function useIncomeStatement(startDate: Date, endDate: Date) {
  // Solo el rango — Firestore filtra antes de mandar.
  const { data: periodTxs, loading } = useTransactionsInRange(startDate, endDate)

  const statement = useMemo<IncomeStatementData>(() => {
    const incomeTxs = periodTxs.filter((t) => t.type === 'income')
    const expenseTxs = periodTxs.filter((t) => t.type === 'expense')

    // Classify income
    const revenueTxs: Transaction[] = []
    const otherIncomeTxs: Transaction[] = []
    for (const t of incomeTxs) {
      if (classifyIncome(t.category) === 'other_income') otherIncomeTxs.push(t)
      else revenueTxs.push(t)
    }

    // Classify expenses
    const costOfSalesTxs: Transaction[] = []
    const operatingTxs: Transaction[] = []
    const otherExpenseTxs: Transaction[] = []
    for (const t of expenseTxs) {
      const cls = classifyExpense(t.category)
      if (cls === 'cost_of_sales') costOfSalesTxs.push(t)
      else if (cls === 'other_expense') otherExpenseTxs.push(t)
      else operatingTxs.push(t)
    }

    const revenue = buildSection('Ingresos Operacionales', revenueTxs)
    const costOfSales = buildSection('Costo de Ventas', costOfSalesTxs)
    const grossProfit = revenue.total - costOfSales.total
    const grossMargin = revenue.total > 0 ? (grossProfit / revenue.total) * 100 : 0

    const operatingExpenses = buildSection('Gastos Operacionales', operatingTxs)
    const operatingProfit = grossProfit - operatingExpenses.total
    const operatingMargin = revenue.total > 0 ? (operatingProfit / revenue.total) * 100 : 0

    const otherIncome = buildSection('Otros Ingresos', otherIncomeTxs)
    const otherExpenses = buildSection('Otros Gastos', otherExpenseTxs)

    const netProfit = operatingProfit + otherIncome.total - otherExpenses.total
    const netMargin = revenue.total > 0 ? (netProfit / revenue.total) * 100 : 0

    return {
      revenue,
      costOfSales,
      grossProfit,
      grossMargin,
      operatingExpenses,
      operatingProfit,
      operatingMargin,
      otherIncome,
      otherExpenses,
      netProfit,
      netMargin,
      transactionCount: periodTxs.length,
    }
  }, [periodTxs])

  return { statement, loading }
}

export interface BudgetComparisonRow {
  category: string
  type: 'income' | 'expense'
  budgeted: number
  actual: number
  difference: number
  execution: number
}

export interface BudgetComparisonData {
  rows: BudgetComparisonRow[]
  totalBudgetedIncome: number
  totalActualIncome: number
  totalBudgetedExpenses: number
  totalActualExpenses: number
  budgetedBalance: number
  actualBalance: number
}

export function useBudget() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data: config, isLoading: loading, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'settings', 'budget'],
    queryFn: () => budgetService.get(companyId!),
    enabled: !!companyId,
  })

  const save = useCallback(async (items: BudgetItem[]) => {
    if (!companyId) return
    const newConfig = { items }
    await budgetService.save(companyId, newConfig)
    queryClient.invalidateQueries({ queryKey: ['firestore', companyId, 'settings', 'budget'] })
  }, [companyId])

  return { config: config ?? { items: [] }, loading, save, refetch }
}

export function useBudgetComparison(startDate: Date, endDate: Date) {
  // Solo el rango — Firestore filtra antes de mandar.
  const { data: periodTxs, loading: txLoading } = useTransactionsInRange(startDate, endDate)
  const { config, loading: budgetLoading, save, refetch } = useBudget()

  const comparison = useMemo<BudgetComparisonData>(() => {
    // Group actual amounts by category+type
    const actualMap = new Map<string, number>()
    for (const t of periodTxs) {
      const key = `${t.category}|${t.type}`
      actualMap.set(key, (actualMap.get(key) ?? 0) + t.amount)
    }

    // Build rows from budget items
    const rows: BudgetComparisonRow[] = config.items.map((item) => {
      const key = `${item.category}|${item.type}`
      const actual = actualMap.get(key) ?? 0
      const difference = item.type === 'income'
        ? actual - item.amount
        : item.amount - actual
      const execution = item.amount > 0 ? (actual / item.amount) * 100 : 0
      return {
        category: item.category,
        type: item.type,
        budgeted: item.amount,
        actual,
        difference,
        execution,
      }
    })

    // Add categories that have actuals but no budget
    for (const [key, actual] of actualMap) {
      const [category, type] = key.split('|')
      if (!config.items.some((i) => i.category === category && i.type === type)) {
        rows.push({
          category,
          type: type as 'income' | 'expense',
          budgeted: 0,
          actual,
          difference: type === 'income' ? actual : -actual,
          execution: 0,
        })
      }
    }

    // Sort: income first, then expense, then by budgeted desc
    rows.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'income' ? -1 : 1
      return b.budgeted - a.budgeted
    })

    const incomeRows = rows.filter((r) => r.type === 'income')
    const expenseRows = rows.filter((r) => r.type === 'expense')

    return {
      rows,
      totalBudgetedIncome: incomeRows.reduce((s, r) => s + r.budgeted, 0),
      totalActualIncome: incomeRows.reduce((s, r) => s + r.actual, 0),
      totalBudgetedExpenses: expenseRows.reduce((s, r) => s + r.budgeted, 0),
      totalActualExpenses: expenseRows.reduce((s, r) => s + r.actual, 0),
      budgetedBalance: incomeRows.reduce((s, r) => s + r.budgeted, 0) - expenseRows.reduce((s, r) => s + r.budgeted, 0),
      actualBalance: incomeRows.reduce((s, r) => s + r.actual, 0) - expenseRows.reduce((s, r) => s + r.actual, 0),
    }
  }, [periodTxs, config])

  return {
    comparison,
    budgetItems: config.items,
    loading: txLoading || budgetLoading,
    saveBudget: save,
    refetchBudget: refetch,
  }
}

/* ─── Bank Reconciliation Hooks ─── */

export function useBankStatements() {
  return useCollection<BankStatement>('bank-statements')
}

export function useBankStatement(id: string | undefined) {
  return useDocument<BankStatement>('bank-statements', id)
}

export function useBankStatementMutation() {
  return useFirestoreMutation<{ id?: string } & Partial<BankStatementFormData>>(
    'bank-statements',
    async (companyId, data) => {
      const { id, ...rest } = data
      if (id) await bankStatementService.update(companyId, id, rest)
      else await bankStatementService.create(companyId, rest as BankStatementFormData)
    },
  )
}

export function useBankStatementDelete() {
  return useFirestoreMutation<string>(
    'bank-statements',
    (companyId, id) => bankStatementService.remove(companyId, id),
    { optimisticDelete: true },
  )
}

export function useReconciliation(statementId: string | undefined) {
  const { data: statement, loading: stmtLoading } = useBankStatement(statementId)
  const { data: transactions, loading: txLoading } = useTransactions()
  const { selectedCompany } = useCompany()

  const runAutoMatch = useCallback(async () => {
    if (!statement || !selectedCompany) return
    const result = autoMatch(statement.entries, transactions)
    await bankStatementService.update(selectedCompany.id, statement.id, {
      matches: result.matches,
      matchedCount: result.matches.length,
      unmatchedBankCount: result.unmatchedBankEntries.length,
      unmatchedTransactionCount: result.unmatchedTransactions.length,
      status: result.unmatchedBankEntries.length === 0 && result.matches.length > 0 ? 'reconciled' : result.matches.length > 0 ? 'partial' : 'pending',
    })
    queryClient.invalidateQueries({ queryKey: ['firestore', selectedCompany.id, 'bank-statements'] })
  }, [statement, transactions, selectedCompany])

  const addManualMatch = useCallback(async (bankEntryId: string, transactionId: string) => {
    if (!statement || !selectedCompany) return
    const newMatch: ReconciliationMatch = { bankEntryId, transactionId, confidence: 100, matchedBy: 'manual' }
    const updated = [...statement.matches, newMatch]
    const matchedBankIds = new Set(updated.map((m) => m.bankEntryId))
    await bankStatementService.update(selectedCompany.id, statement.id, {
      matches: updated,
      matchedCount: updated.length,
      unmatchedBankCount: statement.entries.length - matchedBankIds.size,
      status: matchedBankIds.size === statement.entries.length ? 'reconciled' : 'partial',
    })
    queryClient.invalidateQueries({ queryKey: ['firestore', selectedCompany.id, 'bank-statements'] })
  }, [statement, selectedCompany])

  const removeMatch = useCallback(async (bankEntryId: string) => {
    if (!statement || !selectedCompany) return
    const updated = statement.matches.filter((m) => m.bankEntryId !== bankEntryId)
    const matchedBankIds = new Set(updated.map((m) => m.bankEntryId))
    await bankStatementService.update(selectedCompany.id, statement.id, {
      matches: updated,
      matchedCount: updated.length,
      unmatchedBankCount: statement.entries.length - matchedBankIds.size,
      status: updated.length === 0 ? 'pending' : matchedBankIds.size === statement.entries.length ? 'reconciled' : 'partial',
    })
    queryClient.invalidateQueries({ queryKey: ['firestore', selectedCompany.id, 'bank-statements'] })
  }, [statement, selectedCompany])

  // Build transaction lookup
  const txMap = useMemo(() => {
    const map = new Map<string, Transaction>()
    for (const tx of transactions) map.set(tx.id, tx)
    return map
  }, [transactions])

  return {
    statement,
    transactions,
    txMap,
    loading: stmtLoading || txLoading,
    runAutoMatch,
    addManualMatch,
    removeMatch,
  }
}
