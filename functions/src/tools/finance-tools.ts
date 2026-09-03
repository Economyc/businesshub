import { tool } from 'ai'
import { z } from 'zod'
import { fetchCollection, fetchSettingsDoc } from '../firestore.js'
import { payableOf, pendingOf } from '../utils/withholding.js'

// ─── Helpers ───

function tsToDate(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'object' && val !== null && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000)
  }
  return null
}

function tsToIso(val: unknown): string | null {
  const d = tsToDate(val)
  return d ? d.toISOString().split('T')[0] : null
}

interface RawTransaction {
  id: unknown
  concept: unknown
  category: unknown
  amount: unknown
  type: unknown
  date: unknown
  status: unknown
  notes: unknown
  sourceType: unknown
  [key: string]: unknown
}

function formatTx(t: RawTransaction) {
  return {
    id: t.id,
    concept: t.concept,
    category: t.category,
    amount: t.amount,
    type: t.type,
    date: tsToIso(t.date),
    status: t.status,
    notes: t.notes || null,
    sourceType: t.sourceType || null,
  }
}

function filterByPeriod(
  transactions: Record<string, unknown>[],
  startDate: string,
  endDate: string,
) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  return transactions.filter((t) => {
    const d = tsToDate(t.date)
    return d && d >= start && d <= end
  })
}

export interface CategoryBreakdown {
  category: string
  total: number
  count: number
}

function groupByCategory(txs: Record<string, unknown>[]): CategoryBreakdown[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const t of txs) {
    const cat = String(t.category || 'Sin categoría')
    const existing = map.get(cat) ?? { total: 0, count: 0 }
    existing.total += Number(t.amount) || 0
    existing.count++
    map.set(cat, existing)
  }
  return Array.from(map.entries())
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total)
}

// ─── Classification (mirrors frontend logic) ───

const COST_OF_SALES_CATS = ['suministros', 'insumos', 'costo de ventas']
const OTHER_INCOME_CATS = ['otros', 'propinas']
// 'propinas' simétrico con OTHER_INCOME_CATS: la distribución de propinas se
// cancela con el ingreso de propinas de los cierres sin inflar el margen
// operativo (ver src/modules/finance/hooks.ts).
const OTHER_EXPENSE_CATS = ['impuestos', 'seguros', 'otros', 'propinas']

function normalizeCat(category: string): string {
  return category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(' > ')[0]
    .trim()
}

function classifyExpense(category: string): 'cost_of_sales' | 'operating' | 'other_expense' {
  const norm = normalizeCat(category)
  if (COST_OF_SALES_CATS.some((c) => norm.includes(c))) return 'cost_of_sales'
  if (OTHER_EXPENSE_CATS.some((c) => norm === c)) return 'other_expense'
  return 'operating'
}

function classifyIncome(category: string): 'revenue' | 'other_income' {
  const norm = normalizeCat(category)
  if (OTHER_INCOME_CATS.some((c) => norm === c)) return 'other_income'
  return 'revenue'
}

// ─── Tools ───

export function createFinanceTools(companyId: string) {
  return {
    getTransactions: tool({
      description:
        'Obtiene transacciones del módulo Facturación filtradas por periodo, tipo, categoría, estado, ' +
        'prioridad, proveedor o tipo de documento. Útil para responder "qué facturas tengo pendientes", ' +
        '"vencidos", "facturas urgentes", "transacciones del proveedor X". Si overdueOnly=true ignora ' +
        'startDate/endDate y devuelve sólo lo vencido (pending y fecha < hoy).',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
        endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
        type: z.enum(['income', 'expense']).optional().describe('Filtrar por tipo: income o expense'),
        category: z.string().optional().describe('Filtrar por categoría'),
        status: z.enum(['paid', 'pending', 'overdue']).optional().describe('Filtrar por estado'),
        priority: z
          .enum(['immediate', 'waiting'])
          .optional()
          .describe('Filtrar por prioridad (solo aplica a facturas/compras).'),
        payeeName: z
          .string()
          .optional()
          .describe('Filtro parcial sobre el nombre del proveedor/empleado/socio (case-insensitive).'),
        documentKind: z
          .enum(['invoice', 'purchase'])
          .optional()
          .describe('Filtrar por tipo de documento: invoice (cuenta por pagar) o purchase (compra al contado).'),
        overdueOnly: z
          .boolean()
          .optional()
          .describe(
            'Si true, devuelve sólo transacciones vencidas (status=pending y date < hoy). Ignora startDate/endDate.',
          ),
      }),
      execute: async ({
        startDate,
        endDate,
        type,
        category,
        status,
        priority,
        payeeName,
        documentKind,
        overdueOnly,
      }) => {
        const all = await fetchCollection(companyId, 'transactions')
        let filtered: Record<string, unknown>[]

        if (overdueOnly) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          filtered = all.filter((t) => {
            if (t.status !== 'pending') return false
            const d = tsToDate(t.date)
            return d != null && d < today
          })
        } else {
          filtered = filterByPeriod(all, startDate, endDate)
        }

        if (type) filtered = filtered.filter((t) => t.type === type)
        if (category) {
          filtered = filtered.filter(
            (t) => String(t.category).toLowerCase().includes(category.toLowerCase()),
          )
        }
        if (status) filtered = filtered.filter((t) => t.status === status)
        if (priority) filtered = filtered.filter((t) => t.priority === priority)
        if (documentKind) filtered = filtered.filter((t) => t.documentKind === documentKind)
        if (payeeName) {
          const search = payeeName.toLowerCase().trim()
          filtered = filtered.filter((t) => {
            const ref = t.payeeRef as { name?: string } | undefined
            const name = (ref?.name ?? '').toLowerCase()
            return name.includes(search)
          })
        }

        const totalAmount = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0)

        return {
          count: filtered.length,
          totalAmount,
          transactions: filtered.map((t) => {
            const base = formatTx(t as unknown as RawTransaction)
            return {
              ...base,
              priority: t.priority ?? null,
              documentKind: t.documentKind ?? null,
              docNumber: t.docNumber ?? null,
              payeeName: (t.payeeRef as { name?: string } | undefined)?.name ?? null,
              // Retefuente: `amount` es el gasto causado, `payableAmount` es lo
              // que de verdad hay que girarle al proveedor.
              withholdingAmount: Number(t.withholdingAmount) || 0,
              payableAmount: payableOf(t as { amount?: number; withholdingAmount?: number }),
            }
          }),
        }
      },
    }),

    getPendingInvoicesBySupplier: tool({
      description:
        'Agrupa las facturas pendientes (CxP, status=pending) por proveedor y devuelve totales por cada uno: ' +
        'cantidad de facturas, monto total adeudado, factura más antigua, cuántas están marcadas como urgentes. ' +
        'Útil para responder "top proveedores con más deuda", "cuánto le debo a X", "a quién le debo más". ' +
        'Resultados ordenados por monto total descendente.',
      parameters: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe('Cantidad máxima de proveedores a devolver. Default 10.'),
        documentKind: z
          .enum(['invoice', 'purchase'])
          .optional()
          .describe('Filtrar por tipo de documento. Default "invoice" (facturas por pagar).'),
        payeeName: z
          .string()
          .optional()
          .describe('Si se pasa, devuelve sólo el proveedor que matchea por nombre (case-insensitive parcial).'),
      }),
      execute: async ({ limit = 10, documentKind, payeeName }) => {
        const all = await fetchCollection(companyId, 'transactions')
        const kindFilter = documentKind ?? 'invoice'
        const search = payeeName ? payeeName.toLowerCase().trim() : null

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const pending = all.filter((t) => {
          if (t.status !== 'pending') return false
          if (t.documentKind !== kindFilter) return false
          if (search) {
            const ref = t.payeeRef as { name?: string } | undefined
            const name = (ref?.name ?? '').toLowerCase()
            if (!name.includes(search)) return false
          }
          return true
        })

        const groups = new Map<
          string,
          {
            supplierName: string
            count: number
            total: number
            oldestDate: Date | null
            immediateCount: number
            overdueCount: number
          }
        >()

        for (const t of pending) {
          const ref = t.payeeRef as { name?: string } | undefined
          const name = ref?.name ?? 'Sin proveedor'
          const key = name.toLowerCase().trim()
          const entry = groups.get(key) ?? {
            supplierName: name,
            count: 0,
            total: 0,
            oldestDate: null,
            immediateCount: 0,
            overdueCount: 0,
          }
          entry.count += 1
          // Lo que falta GIRARLE al proveedor, no el bruto causado: descuenta la
          // retefuente y los abonos ya hechos (mismo criterio que el PDF de
          // pendientes de Telegram, para que las dos cifras coincidan).
          entry.total += pendingOf(t as { amount?: number; paidAmount?: number; remainingAmount?: number; withholdingAmount?: number })
          const d = tsToDate(t.date)
          if (d && (!entry.oldestDate || d < entry.oldestDate)) entry.oldestDate = d
          if (t.priority === 'immediate') entry.immediateCount += 1
          if (d && d < today) entry.overdueCount += 1
          groups.set(key, entry)
        }

        const ranked = Array.from(groups.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, limit)
          .map((g) => ({
            supplierName: g.supplierName,
            count: g.count,
            total: g.total,
            oldestDate: g.oldestDate ? g.oldestDate.toISOString().split('T')[0] : null,
            immediateCount: g.immediateCount,
            overdueCount: g.overdueCount,
          }))

        const grandTotal = ranked.reduce((s, r) => s + r.total, 0)
        const grandCount = ranked.reduce((s, r) => s + r.count, 0)

        return {
          documentKind: kindFilter,
          supplierCount: ranked.length,
          totalInvoices: grandCount,
          totalAmount: grandTotal,
          suppliers: ranked,
        }
      },
    }),

    getCashFlow: tool({
      description: 'Calcula el flujo de caja para un periodo: ingresos, gastos, balance, desglose por categoría.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
        endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
      }),
      execute: async ({ startDate, endDate }) => {
        const all = await fetchCollection(companyId, 'transactions')
        const start = new Date(startDate)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)

        const paid = all.filter((t) => t.status === 'paid')

        // Opening balance: all paid before period
        const beforePeriod = paid.filter((t) => {
          const d = tsToDate(t.date)
          return d && d < start
        })
        const openingBalance = beforePeriod.reduce(
          (sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
          0
        )

        // Period transactions
        const periodPaid = paid.filter((t) => {
          const d = tsToDate(t.date)
          return d && d >= start && d <= end
        })

        const incomeTxs = periodPaid.filter((t) => t.type === 'income')
        const expenseTxs = periodPaid.filter((t) => t.type === 'expense')
        const totalIncome = incomeTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const totalExpenses = expenseTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const netFlow = totalIncome - totalExpenses

        // Pending
        const periodPending = all.filter((t) => {
          const d = tsToDate(t.date)
          return d && d >= start && d <= end && (t.status === 'pending' || t.status === 'overdue')
        })
        const pendingIncome = periodPending
          .filter((t) => t.type === 'income')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const pendingExpenses = periodPending
          .filter((t) => t.type === 'expense')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0)

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
          transactionCount: periodPaid.length,
        }
      },
    }),

    getIncomeStatement: tool({
      description: 'Genera el estado de resultados (P&L) para un periodo: ingresos, costos, utilidad bruta, gastos operacionales, utilidad neta y márgenes.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
        endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
      }),
      execute: async ({ startDate, endDate }) => {
        const all = await fetchCollection(companyId, 'transactions')
        const period = filterByPeriod(all, startDate, endDate)

        const incomeTxs = period.filter((t) => t.type === 'income')
        const expenseTxs = period.filter((t) => t.type === 'expense')

        // Classify income
        const revenueTxs = incomeTxs.filter((t) => classifyIncome(String(t.category)) === 'revenue')
        const otherIncomeTxs = incomeTxs.filter((t) => classifyIncome(String(t.category)) === 'other_income')

        // Classify expenses
        const costOfSalesTxs = expenseTxs.filter((t) => classifyExpense(String(t.category)) === 'cost_of_sales')
        const operatingTxs = expenseTxs.filter((t) => classifyExpense(String(t.category)) === 'operating')
        const otherExpenseTxs = expenseTxs.filter((t) => classifyExpense(String(t.category)) === 'other_expense')

        const revenue = revenueTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const costOfSales = costOfSalesTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const grossProfit = revenue - costOfSales
        const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

        const operatingExpenses = operatingTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const operatingProfit = grossProfit - operatingExpenses
        const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0

        const otherIncome = otherIncomeTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const otherExpenses = otherExpenseTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)

        const netProfit = operatingProfit + otherIncome - otherExpenses
        const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

        return {
          revenue: { total: revenue, categories: groupByCategory(revenueTxs) },
          costOfSales: { total: costOfSales, categories: groupByCategory(costOfSalesTxs) },
          grossProfit,
          grossMarginPercent: Math.round(grossMargin * 100) / 100,
          operatingExpenses: { total: operatingExpenses, categories: groupByCategory(operatingTxs) },
          operatingProfit,
          operatingMarginPercent: Math.round(operatingMargin * 100) / 100,
          otherIncome: { total: otherIncome, categories: groupByCategory(otherIncomeTxs) },
          otherExpenses: { total: otherExpenses, categories: groupByCategory(otherExpenseTxs) },
          netProfit,
          netMarginPercent: Math.round(netMargin * 100) / 100,
          transactionCount: period.length,
        }
      },
    }),

    getBudgetComparison: tool({
      description: 'Compara el presupuesto configurado contra los montos reales del periodo.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
        endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
      }),
      execute: async ({ startDate, endDate }) => {
        const [all, budgetDoc] = await Promise.all([
          fetchCollection(companyId, 'transactions'),
          fetchSettingsDoc(companyId, 'budget'),
        ])

        const budgetItems = (budgetDoc?.items as Array<{ category: string; type: string; amount: number }>) ?? []
        const period = filterByPeriod(all, startDate, endDate)

        // Group actual amounts
        const actualMap = new Map<string, number>()
        for (const t of period) {
          const key = `${t.category}|${t.type}`
          actualMap.set(key, (actualMap.get(key) ?? 0) + (Number(t.amount) || 0))
        }

        const rows = budgetItems.map((item) => {
          const key = `${item.category}|${item.type}`
          const actual = actualMap.get(key) ?? 0
          const difference = item.type === 'income' ? actual - item.amount : item.amount - actual
          const execution = item.amount > 0 ? (actual / item.amount) * 100 : 0
          return {
            category: item.category,
            type: item.type,
            budgeted: item.amount,
            actual,
            difference,
            executionPercent: Math.round(execution * 100) / 100,
          }
        })

        // Categories with actuals but no budget
        for (const [key, actual] of actualMap) {
          const [category, type] = key.split('|')
          if (!budgetItems.some((i) => i.category === category && i.type === type)) {
            rows.push({
              category,
              type,
              budgeted: 0,
              actual,
              difference: type === 'income' ? actual : -actual,
              executionPercent: 0,
            })
          }
        }

        const incomeRows = rows.filter((r) => r.type === 'income')
        const expenseRows = rows.filter((r) => r.type === 'expense')

        return {
          rows,
          totalBudgetedIncome: incomeRows.reduce((s, r) => s + r.budgeted, 0),
          totalActualIncome: incomeRows.reduce((s, r) => s + r.actual, 0),
          totalBudgetedExpenses: expenseRows.reduce((s, r) => s + r.budgeted, 0),
          totalActualExpenses: expenseRows.reduce((s, r) => s + r.actual, 0),
        }
      },
    }),

    getExpensesByCategory: tool({
      description: 'Obtiene el desglose de gastos por categoría para un periodo.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
        endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
      }),
      execute: async ({ startDate, endDate }) => {
        const all = await fetchCollection(companyId, 'transactions')
        const period = filterByPeriod(all, startDate, endDate)
        const expenses = period.filter((t) => t.type === 'expense')
        const total = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0)

        return {
          totalExpenses: total,
          transactionCount: expenses.length,
          categories: groupByCategory(expenses),
        }
      },
    }),
  }
}
