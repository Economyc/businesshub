import { tool } from 'ai'
import { z } from 'zod'
import { fetchCollection } from '../firestore.js'

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

function getWeekRange(startDateStr?: string): { start: Date; end: Date } {
  const now = startDateStr ? new Date(startDateStr) : new Date()
  const day = now.getDay()
  const start = new Date(now)
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)) // Monday
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 6) // Sunday
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

// ─── Tools ───

export function createObligationsTools(companyId: string) {
  return {
    getWeeklyObligations: tool({
      description:
        'Lista las obligaciones de pago de la semana: gastos pendientes, transacciones recurrentes próximas y estado de nómina. Priorizada por urgencia y monto.',
      parameters: z.object({
        weekStartDate: z
          .string()
          .optional()
          .describe('Fecha de inicio de la semana (YYYY-MM-DD). Default: semana actual.'),
      }),
      execute: async ({ weekStartDate }) => {
        const { start, end } = getWeekRange(weekStartDate)
        const now = new Date()

        const [transactions, recurring, payrolls] = await Promise.all([
          fetchCollection(companyId, 'transactions'),
          fetchCollection(companyId, 'recurring-transactions'),
          fetchCollection(companyId, 'payrolls'),
        ])

        // 1. Pending/overdue expense transactions in or before this week
        const pendingExpenses = transactions
          .filter((t) => {
            if (t.type !== 'expense') return false
            if (t.status !== 'pending' && t.status !== 'overdue') return false
            const d = tsToDate(t.date)
            return d && d <= end
          })
          .map((t) => {
            const d = tsToDate(t.date)
            const isOverdue = d ? d < now : false
            return {
              type: 'expense' as const,
              id: t.id,
              concept: String(t.concept ?? ''),
              category: String(t.category ?? ''),
              amount: Number(t.amount) || 0,
              date: tsToIso(t.date),
              isOverdue,
              urgency: isOverdue ? 'overdue' : 'due_this_week',
              priority: isOverdue ? 0 : 1,
            }
          })

        // 2. Recurring transactions due this week
        const activeRecurring = recurring.filter((r) => r.isActive === true)
        const recurringDue = activeRecurring
          .filter((r) => {
            const nextDue = tsToDate(r.nextDueDate)
            return nextDue && nextDue >= start && nextDue <= end
          })
          .map((r) => ({
            type: 'recurring' as const,
            id: r.id,
            concept: String(r.concept ?? ''),
            category: String(r.category ?? ''),
            amount: Number(r.amount) || 0,
            date: tsToIso(r.nextDueDate),
            isOverdue: false,
            urgency: 'recurring_due' as const,
            priority: 2,
          }))

        // 3. Check payroll status for current month
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()
        const currentPayroll = payrolls.find(
          (p) => Number(p.year) === currentYear && Number(p.month) === currentMonth
        )

        let payrollStatus: {
          exists: boolean
          status?: string
          totalNetPay?: number
          employeeCount?: number
        }

        if (!currentPayroll) {
          payrollStatus = { exists: false }
        } else {
          payrollStatus = {
            exists: true,
            status: String(currentPayroll.status),
            totalNetPay: Number(currentPayroll.totalNetPay) || 0,
            employeeCount: Number(currentPayroll.employeeCount) || 0,
          }
        }

        // Combine and sort by priority then amount
        const allObligations = [...pendingExpenses, ...recurringDue].sort(
          (a, b) => a.priority - b.priority || b.amount - a.amount
        )

        const totalAmount = allObligations.reduce((s, o) => s + o.amount, 0)
        const overdueAmount = allObligations
          .filter((o) => o.isOverdue)
          .reduce((s, o) => s + o.amount, 0)

        return {
          weekRange: {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
          },
          totalObligations: allObligations.length,
          totalAmount,
          overdueCount: allObligations.filter((o) => o.isOverdue).length,
          overdueAmount,
          obligations: allObligations,
          payrollStatus,
        }
      },
    }),
  }
}
