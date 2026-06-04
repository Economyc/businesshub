import { useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCollection } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy, where, Timestamp } from 'firebase/firestore'
import { useCompany } from '@/core/hooks/use-company'
import { queryClient } from '@/core/query/query-client'
import { fetchCollection } from '@/core/firebase/helpers'
import { parseCategory } from '@/core/utils/categories'
import { budgetService } from './services'
import { generatePendingTransactions } from './recurring-generator'
import type { Transaction, RecurringTransaction, BudgetItem } from './types'
import type { Supplier } from '@/modules/suppliers/types'

export function useTransactions() {
  return useCollection<Transaction>('transactions')
}

export function usePaginatedTransactions() {
  return usePaginatedCollection<Transaction>('transactions', 50, orderBy('date', 'desc'))
}

// Todas las facturas pendientes/overdue. Sin paginación, sin filtro de fecha —
// las pendientes son arrastres de deuda y deben verse aunque tengan meses.
// Reemplaza el patrón "paginar transactions y filtrar in-memory" que dejaba
// fuera facturas viejas cuando había muchos cierres/recurrentes recientes.
export function useInvoicesPending() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'transactions', 'invoices-pending'],
    queryFn: () =>
      fetchCollection<Transaction>(
        companyId!,
        'transactions',
        where('documentKind', '==', 'invoice'),
        where('status', 'in', ['pending', 'overdue']),
        orderBy('date', 'desc'),
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

// Todas las facturas/compras pagadas. Sin paginación. El rango se aplica
// in-memory por (paidDate ?? date) en el componente — necesario porque hay
// data legacy sin paidDate y porque "pagadas en X" lee paidDate, no date.
export function useInvoicesAndPurchasesPaid() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'transactions', 'invoices-paid'],
    queryFn: () =>
      fetchCollection<Transaction>(
        companyId!,
        'transactions',
        where('status', '==', 'paid'),
        where('documentKind', 'in', ['invoice', 'purchase']),
        orderBy('date', 'desc'),
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
    const companyId = selectedCompany.id
    generatePendingTransactions(companyId).then((count) => {
      if (count > 0) {
        refetch()
        // Tirar abajo todas las queries cacheadas de transactions —
        // los hooks de Facturación (useInvoicesPending/Paid) y los de
        // rango (useTransactionsInRange/Until) viven aparte de useTransactions.
        queryClient.invalidateQueries({ queryKey: ['firestore', companyId, 'transactions'] })
      }
    })
  }, [selectedCompany?.id])
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
// 'propinas' va aquí también: las propinas no son gasto operativo del negocio
// (son de los empleados). Así el gasto de distribución de propinas se cancela
// simétricamente con el ingreso de propinas de los cierres en la sección
// "Otros" del P&L, sin inflar el margen operativo.
const OTHER_EXPENSE_CATS = ['impuestos', 'seguros', 'otros', 'propinas']

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
  // Traemos todo hasta endDate (como Cash Flow) porque los gastos se ubican por
  // fecha de PAGO (paidDate), no de emisión: una factura emitida antes del
  // período pero pagada dentro de él debe contar, y el filtro Firestore por
  // `date` la dejaría fuera.
  const { data: periodTxs, loading } = useTransactionsUntil(endDate)

  const statement = useMemo<IncomeStatementData>(() => {
    const inRange = (d?: Date | null) => !!d && d >= startDate && d <= endDate

    // Ingresos: criterio de causación por fecha de emisión (sin cambios).
    const incomeTxs = periodTxs.filter(
      (t) => t.type === 'income' && inRange(t.date?.toDate?.()),
    )
    // Gastos: criterio de caja — solo lo efectivamente pagado, ubicado por
    // fecha de pago (fallback a `date` para data legacy sin paidDate). Las
    // cuentas por pagar (pending/overdue) quedan excluidas hasta liquidarse.
    const expenseTxs = periodTxs.filter(
      (t) =>
        t.type === 'expense' &&
        t.status === 'paid' &&
        inRange((t.paidDate ?? t.date)?.toDate?.()),
    )

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
      transactionCount: incomeTxs.length + expenseTxs.length,
    }
  }, [periodTxs, startDate.getTime(), endDate.getTime()])

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

// ── Análisis Finanzas ───────────────────────────────────────────────────────
// Desglose de gastos del período para tomar decisiones: cuánto se fue por
// categoría de gasto, por proveedor y por categoría de proveedor, con ranking
// (% del total), comparación contra el período anterior y tendencia mensual.
// Criterio de CAJA (igual que el Estado de Resultados): solo gastos pagados,
// ubicados por fecha de pago (paidDate ?? date). Las cuentas por pagar
// pendientes quedan fuera hasta liquidarse.

export interface ExpenseGroup {
  key: string
  label: string
  total: number
  prevTotal: number
  /** % del total de gasto del período. */
  share: number
  /** Variación % vs el mismo rubro en el período anterior. */
  deltaPct: number
  transactions: Transaction[]
  /** Desglose por subcategoría (solo se llena para byCategory). */
  subgroups?: ExpenseGroup[]
}

export interface ExpenseTrendPoint {
  /** Clave ordenable YYYY-MM. */
  month: string
  /** Etiqueta legible (ej. "Ene"). */
  monthLabel: string
  total: number
}

export interface ExpenseAnalysisData {
  total: number
  totalPrev: number
  totalDeltaPct: number
  /** Compras a proveedores + insumos (costo de ventas). */
  supplierSpend: number
  supplierSpendPrev: number
  /** Resto de egresos (nómina, fijos, impuestos, etc.). */
  otherSpend: number
  byCategory: ExpenseGroup[]
  bySupplier: ExpenseGroup[]
  bySupplierCategory: ExpenseGroup[]
  monthlyTrend: ExpenseTrendPoint[]
  transactionCount: number
}

function cashDate(t: Transaction): Date | null {
  return (t.paidDate ?? t.date)?.toDate?.() ?? null
}

// Id real del payee, o null si es un tercero externo/custom. Los externos se
// guardan con un id centinela COMPARTIDO ('external' o '' según el flujo) y se
// distinguen entre sí por nombre, no por id — agrupar por ese id colapsaría a
// todos los externos en un solo "proveedor".
function realPayeeId(t: Transaction): string | null {
  const id = t.payeeRef?.id
  return id && id !== 'external' ? id : null
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100
  return ((curr - prev) / prev) * 100
}

// Un gasto cuenta como "proveedor/insumo" si tiene proveedor asociado o si su
// categoría cae en costo de ventas (reusa la clasificación del P&L).
function isSupplierSpend(t: Transaction): boolean {
  return t.payeeRef?.type === 'supplier' || classifyExpense(t.category) === 'cost_of_sales'
}

function buildExpenseGroups(
  current: Transaction[],
  previous: Transaction[],
  keyFn: (t: Transaction) => { key: string; label: string },
): ExpenseGroup[] {
  const currMap = new Map<string, { label: string; total: number; transactions: Transaction[] }>()
  for (const t of current) {
    const { key, label } = keyFn(t)
    if (!currMap.has(key)) currMap.set(key, { label, total: 0, transactions: [] })
    const g = currMap.get(key)!
    g.total += t.amount
    g.transactions.push(t)
  }

  const prevMap = new Map<string, number>()
  for (const t of previous) {
    const { key } = keyFn(t)
    prevMap.set(key, (prevMap.get(key) ?? 0) + t.amount)
  }

  const periodTotal = current.reduce((s, t) => s + t.amount, 0)

  return Array.from(currMap.entries())
    .map(([key, g]) => {
      const prevTotal = prevMap.get(key) ?? 0
      return {
        key,
        label: g.label,
        total: g.total,
        prevTotal,
        share: periodTotal > 0 ? (g.total / periodTotal) * 100 : 0,
        deltaPct: pctChange(g.total, prevTotal),
        transactions: g.transactions.slice().sort((a, b) => b.amount - a.amount),
      }
    })
    .sort((a, b) => b.total - a.total)
}

export function useExpenseAnalysis(startDate: Date, endDate: Date) {
  // Igual que el Estado de Resultados: traemos todo hasta endDate porque los
  // gastos se ubican por fecha de pago y el período anterior queda antes del
  // startDate, así que un filtro por rango los dejaría fuera.
  const { data: allTxs, loading: txLoading } = useTransactionsUntil(endDate)
  const { data: suppliers, loading: supLoading } = useCollection<Supplier>('suppliers')

  const data = useMemo<ExpenseAnalysisData>(() => {
    const supplierCat = new Map<string, string>()
    for (const s of suppliers) {
      supplierCat.set(s.id, s.category?.trim() || 'Sin categoría')
    }

    // Período anterior: misma longitud, inmediatamente antes del inicio.
    const periodMs = endDate.getTime() - startDate.getTime()
    const prevEnd = new Date(startDate.getTime() - 1)
    const prevStart = new Date(startDate.getTime() - periodMs - 1)

    const paidExpenses = allTxs.filter((t) => t.type === 'expense' && t.status === 'paid')
    const within = (d: Date | null, a: Date, b: Date) => !!d && d >= a && d <= b

    const current = paidExpenses.filter((t) => within(cashDate(t), startDate, endDate))
    const previous = paidExpenses.filter((t) => within(cashDate(t), prevStart, prevEnd))

    const total = current.reduce((s, t) => s + t.amount, 0)
    const totalPrev = previous.reduce((s, t) => s + t.amount, 0)

    const supplierSpend = current.filter(isSupplierSpend).reduce((s, t) => s + t.amount, 0)
    const supplierSpendPrev = previous.filter(isSupplierSpend).reduce((s, t) => s + t.amount, 0)
    const otherSpend = total - supplierSpend

    const byCategory = buildExpenseGroups(current, previous, (t) => {
      const parent = parseCategory(t.category || 'Sin categoría').category || 'Sin categoría'
      return { key: parent, label: parent }
    })
    // Desglose por subcategoría dentro de cada madre. Particionamos el período
    // anterior por madre para conservar prevTotal/deltaPct correctos.
    const prevByParent = new Map<string, Transaction[]>()
    for (const t of previous) {
      const parent = parseCategory(t.category || 'Sin categoría').category || 'Sin categoría'
      const arr = prevByParent.get(parent) ?? []
      arr.push(t)
      prevByParent.set(parent, arr)
    }
    for (const g of byCategory) {
      g.subgroups = buildExpenseGroups(g.transactions, prevByParent.get(g.key) ?? [], (t) => {
        const sub = parseCategory(t.category || '').subcategory || 'Sin subcategoría'
        return { key: sub, label: sub }
      })
    }
    const bySupplier = buildExpenseGroups(current, previous, (t) => {
      const p = t.payeeRef
      if (!p) return { key: '∅', label: 'Sin proveedor' }
      const realId = realPayeeId(t)
      if (realId) return { key: `id:${realId}`, label: p.name }
      // Externos/custom: agrupar por nombre normalizado, no por el id centinela.
      const norm = (p.name || '').trim().toLowerCase()
      return norm ? { key: `name:${norm}`, label: p.name } : { key: '∅', label: 'Sin proveedor' }
    })
    const bySupplierCategory = buildExpenseGroups(current, previous, (t) => {
      if (!t.payeeRef) return { key: 'Sin proveedor', label: 'Sin proveedor' }
      const realId = realPayeeId(t)
      const cat = realId ? (supplierCat.get(realId) ?? 'Sin categoría') : 'Sin categoría'
      return { key: cat, label: cat }
    })

    const monthMap = new Map<string, number>()
    for (const t of current) {
      const d = cashDate(t)
      if (!d) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap.set(key, (monthMap.get(key) ?? 0) + t.amount)
    }
    const monthlyTrend: ExpenseTrendPoint[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, monthTotal]) => {
        const [y, m] = month.split('-')
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-CO', {
          month: 'short',
        })
        return { month, monthLabel: label.charAt(0).toUpperCase() + label.slice(1), total: monthTotal }
      })

    return {
      total,
      totalPrev,
      totalDeltaPct: pctChange(total, totalPrev),
      supplierSpend,
      supplierSpendPrev,
      otherSpend,
      byCategory,
      bySupplier,
      bySupplierCategory,
      monthlyTrend,
      transactionCount: current.length,
    }
  }, [allTxs, suppliers, startDate.getTime(), endDate.getTime()])

  return { data, loading: txLoading || supLoading }
}

