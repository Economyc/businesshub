import { tool } from 'ai'
import { z } from 'zod'
import { fetchCollection, fetchSettingsDoc } from '../firestore.js'
import { reportProgress } from './utils/tool-progress.js'

// ─── Helpers ───

function tsToDate(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'object' && val !== null && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000)
  }
  return null
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

export interface CategoryTotal {
  category: string
  total: number
  count: number
}

function groupByCategory(txs: Record<string, unknown>[]): CategoryTotal[] {
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

/** Shift a date back by N months */
function shiftMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - months)
  return d.toISOString().split('T')[0]
}

// ─── Tools ───

export function createAnalysisTools(companyId: string) {
  return {
    analyzeExpensesTrend: tool({
      description:
        'Analiza la tendencia de gastos comparando dos periodos. Identifica categorías con mayor incremento y detecta si los gastos suben pero las ventas no. Ideal para informes ejecutivos.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio del periodo actual (YYYY-MM-DD)'),
        endDate: z.string().describe('Fecha fin del periodo actual (YYYY-MM-DD)'),
        compareWithPrevious: z
          .boolean()
          .optional()
          .default(true)
          .describe('Comparar con el periodo anterior de la misma duración'),
      }),
      execute: async ({ startDate, endDate, compareWithPrevious }) => {
        const all = await fetchCollection(companyId, 'transactions')

        // Current period
        const currentTxs = filterByPeriod(all, startDate, endDate)
        const currentExpenses = currentTxs.filter((t) => t.type === 'expense')
        const currentIncome = currentTxs.filter((t) => t.type === 'income')
        const totalCurrentExpenses = currentExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const totalCurrentIncome = currentIncome.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const currentByCategory = groupByCategory(currentExpenses)

        const result: Record<string, unknown> = {
          period: { startDate, endDate },
          totalExpenses: totalCurrentExpenses,
          totalIncome: totalCurrentIncome,
          netResult: totalCurrentIncome - totalCurrentExpenses,
          expensesByCategory: currentByCategory,
          transactionCount: currentTxs.length,
        }

        if (compareWithPrevious) {
          // Calculate previous period of same duration
          const startMs = new Date(startDate).getTime()
          const endMs = new Date(endDate).getTime()
          const durationMs = endMs - startMs
          const prevEnd = new Date(startMs - 1) // day before current start
          const prevStart = new Date(prevEnd.getTime() - durationMs)
          const prevStartStr = prevStart.toISOString().split('T')[0]
          const prevEndStr = prevEnd.toISOString().split('T')[0]

          const prevTxs = filterByPeriod(all, prevStartStr, prevEndStr)
          const prevExpenses = prevTxs.filter((t) => t.type === 'expense')
          const prevIncome = prevTxs.filter((t) => t.type === 'income')
          const totalPrevExpenses = prevExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0)
          const totalPrevIncome = prevIncome.reduce((s, t) => s + (Number(t.amount) || 0), 0)
          const prevByCategory = groupByCategory(prevExpenses)

          // Compare categories
          const prevCategoryMap = new Map(prevByCategory.map((c) => [c.category, c.total]))
          const categoryChanges = currentByCategory.map((curr) => {
            const prev = prevCategoryMap.get(curr.category) ?? 0
            const change = prev > 0 ? ((curr.total - prev) / prev) * 100 : curr.total > 0 ? 100 : 0
            return {
              category: curr.category,
              current: curr.total,
              previous: prev,
              changePercent: Math.round(change * 100) / 100,
              increased: curr.total > prev,
            }
          })

          // Alerts
          const alerts: string[] = []
          const expenseChange = totalPrevExpenses > 0
            ? ((totalCurrentExpenses - totalPrevExpenses) / totalPrevExpenses) * 100
            : 0
          const incomeChange = totalPrevIncome > 0
            ? ((totalCurrentIncome - totalPrevIncome) / totalPrevIncome) * 100
            : 0

          if (expenseChange > 10 && incomeChange < 5) {
            alerts.push(
              `Los gastos aumentaron ${Math.round(expenseChange)}% pero los ingresos solo ${Math.round(incomeChange)}%. Revisar control de costos.`
            )
          }
          if (expenseChange > 20) {
            alerts.push(`Los gastos subieron significativamente (${Math.round(expenseChange)}%).`)
          }

          const topIncreases = categoryChanges
            .filter((c) => c.increased && c.changePercent > 15)
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, 5)

          if (topIncreases.length > 0) {
            for (const c of topIncreases) {
              alerts.push(
                `${c.category}: subió ${c.changePercent}% (de $${c.previous.toLocaleString()} a $${c.current.toLocaleString()})`
              )
            }
          }

          result.previousPeriod = { startDate: prevStartStr, endDate: prevEndStr }
          result.previousTotalExpenses = totalPrevExpenses
          result.previousTotalIncome = totalPrevIncome
          result.expenseChangePercent = Math.round(expenseChange * 100) / 100
          result.incomeChangePercent = Math.round(incomeChange * 100) / 100
          result.categoryComparison = categoryChanges.sort(
            (a, b) => b.changePercent - a.changePercent
          )
          result.alerts = alerts
        }

        return result
      },
    }),

    generateExecutiveReport: tool({
      description:
        'Genera un resumen ejecutivo completo del periodo: ingresos, gastos, márgenes, comparación con presupuesto, y alertas de tendencias preocupantes.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio del periodo (YYYY-MM-DD)'),
        endDate: z.string().describe('Fecha fin del periodo (YYYY-MM-DD)'),
      }),
      execute: async ({ startDate, endDate }, { toolCallId }) => {
        // Wave 2.3 — progreso incremental. void = fire-and-forget para no
        // bloquear el camino crítico mientras Firestore confirma el write.
        void reportProgress(toolCallId, { label: 'Cargando transacciones', status: 'running' })

        const [allTxs, budgetDoc, employees, suppliers] = await Promise.all([
          fetchCollection(companyId, 'transactions'),
          fetchSettingsDoc(companyId, 'budget'),
          fetchCollection(companyId, 'employees'),
          fetchCollection(companyId, 'suppliers'),
        ])

        void reportProgress(toolCallId, { label: 'Calculando P&L', status: 'running' })

        const period = filterByPeriod(allTxs, startDate, endDate)
        const income = period.filter((t) => t.type === 'income')
        const expenses = period.filter((t) => t.type === 'expense')
        const totalIncome = income.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const totalExpenses = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const netProfit = totalIncome - totalExpenses
        const netMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0

        void reportProgress(toolCallId, { label: 'Analizando tendencias', status: 'running' })

        // Previous period comparison
        const startMs = new Date(startDate).getTime()
        const endMs = new Date(endDate).getTime()
        const durationMs = endMs - startMs
        const prevEnd = new Date(startMs - 1)
        const prevStart = new Date(prevEnd.getTime() - durationMs)
        const prevStartStr = prevStart.toISOString().split('T')[0]
        const prevEndStr = prevEnd.toISOString().split('T')[0]
        const prevPeriod = filterByPeriod(allTxs, prevStartStr, prevEndStr)
        const prevIncome = prevPeriod.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const prevExpenses = prevPeriod.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0)

        // Budget comparison
        const budgetItems = (budgetDoc?.items as Array<{ category: string; type: string; amount: number }>) ?? []
        const totalBudgetedExpenses = budgetItems.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0)
        const totalBudgetedIncome = budgetItems.filter((i) => i.type === 'income').reduce((s, i) => s + i.amount, 0)

        // Pending transactions
        const pending = period.filter((t) => t.status === 'pending' || t.status === 'overdue')
        const overdueAmount = period
          .filter((t) => t.status === 'overdue')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0)

        // Alerts
        const alerts: string[] = []

        const incomeChange = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0
        const expenseChange = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0

        if (expenseChange > 10 && incomeChange < 5) {
          alerts.push('Los gastos crecen más rápido que los ingresos.')
        }
        if (netMargin < 10 && totalIncome > 0) {
          alerts.push(`Margen neto bajo: ${Math.round(netMargin)}%.`)
        }
        if (totalBudgetedExpenses > 0 && totalExpenses > totalBudgetedExpenses * 1.1) {
          alerts.push('Los gastos superan el presupuesto en más del 10%.')
        }
        if (overdueAmount > 0) {
          alerts.push(`Hay $${overdueAmount.toLocaleString()} en transacciones vencidas.`)
        }

        // Top 5 expense categories
        const topExpenses = groupByCategory(expenses).slice(0, 5)

        void reportProgress(toolCallId, { label: 'Preparando respuesta', status: 'done' })

        return {
          period: { startDate, endDate },
          // Core financials
          totalIncome,
          totalExpenses,
          netProfit,
          netMarginPercent: Math.round(netMargin * 100) / 100,
          transactionCount: period.length,
          // Trends
          incomeChangeVsPrevPeriod: Math.round(incomeChange * 100) / 100,
          expenseChangeVsPrevPeriod: Math.round(expenseChange * 100) / 100,
          // Budget
          budgetedIncome: totalBudgetedIncome,
          budgetedExpenses: totalBudgetedExpenses,
          budgetExpenseExecution: totalBudgetedExpenses > 0
            ? Math.round((totalExpenses / totalBudgetedExpenses) * 10000) / 100
            : null,
          // Operational
          activeEmployees: employees.filter((e) => e.status === 'active').length,
          activeSuppliers: suppliers.filter((s) => s.status === 'active').length,
          pendingTransactions: pending.length,
          overdueAmount,
          // Breakdowns
          topExpenseCategories: topExpenses,
          // Alerts
          alerts,
        }
      },
    }),
  }
}
