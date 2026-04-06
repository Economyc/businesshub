import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue } from 'firebase-admin/firestore'
import { db, fetchCollection, fetchSettingsDoc } from './firestore.js'

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

async function createNotification(
  companyId: string,
  data: {
    type: string
    title: string
    summary: string
    data?: Record<string, unknown>
  }
) {
  await db
    .collection('companies')
    .doc(companyId)
    .collection('notifications')
    .add({
      ...data,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
}

async function getAllCompanyIds(): Promise<string[]> {
  const snapshot = await db.collection('companies').get()
  return snapshot.docs.map((doc) => doc.id)
}

// ─── Weekly Business Report ───

export const weeklyBusinessReport = onSchedule(
  {
    schedule: 'every monday 07:00',
    timeZone: 'America/Bogota',
    memory: '256MiB',
  },
  async () => {
    const companyIds = await getAllCompanyIds()

    for (const companyId of companyIds) {
      try {
        const now = new Date()
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const startDate = weekAgo.toISOString().split('T')[0]
        const endDate = now.toISOString().split('T')[0]

        const [transactions, employees, suppliers] = await Promise.all([
          fetchCollection(companyId, 'transactions'),
          fetchCollection(companyId, 'employees'),
          fetchCollection(companyId, 'suppliers'),
        ])

        const periodTxs = filterByPeriod(transactions, startDate, endDate)
        const income = periodTxs
          .filter((t) => t.type === 'income')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0)
        const expenses = periodTxs
          .filter((t) => t.type === 'expense')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0)

        const overdue = transactions.filter((t) => t.status === 'overdue')
        const overdueTotal = overdue.reduce((s, t) => s + (Number(t.amount) || 0), 0)

        const activeEmployees = employees.filter((e) => e.status === 'active').length
        const activeSuppliers = suppliers.filter((s) => s.status === 'active').length

        const summaryParts: string[] = []
        summaryParts.push(`Ingresos: $${income.toLocaleString('es-CO')}`)
        summaryParts.push(`Gastos: $${expenses.toLocaleString('es-CO')}`)
        if (overdueTotal > 0) {
          summaryParts.push(`${overdue.length} facturas vencidas ($${overdueTotal.toLocaleString('es-CO')})`)
        }

        await createNotification(companyId, {
          type: 'weekly-report',
          title: `Resumen Semanal — ${startDate} al ${endDate}`,
          summary: summaryParts.join(' | '),
          data: {
            income,
            expenses,
            netProfit: income - expenses,
            overdueCount: overdue.length,
            overdueTotal,
            activeEmployees,
            activeSuppliers,
            transactionCount: periodTxs.length,
          },
        })

        console.log(`[WeeklyReport] Generated for company ${companyId}`)
      } catch (error) {
        console.error(`[WeeklyReport] Error for company ${companyId}:`, error)
      }
    }
  }
)

// ─── Daily Overdue Check ───

export const dailyOverdueCheck = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'America/Bogota',
    memory: '256MiB',
  },
  async () => {
    const companyIds = await getAllCompanyIds()
    const now = new Date()

    for (const companyId of companyIds) {
      try {
        const transactions = await fetchCollection(companyId, 'transactions')

        // Find pending transactions with past due dates
        const newlyOverdue = transactions.filter((t) => {
          if (t.status !== 'pending') return false
          const d = tsToDate(t.date)
          if (!d) return false
          // If the transaction date is more than 30 days ago and still pending, mark as overdue
          const daysSince = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
          return daysSince > 30
        })

        if (newlyOverdue.length === 0) continue

        // Update status to overdue
        const batch = db.batch()
        for (const tx of newlyOverdue) {
          const ref = db
            .collection('companies')
            .doc(companyId)
            .collection('transactions')
            .doc(String(tx.id))
          batch.update(ref, { status: 'overdue', updatedAt: FieldValue.serverTimestamp() })
        }
        await batch.commit()

        // Create notification
        const totalAmount = newlyOverdue.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        await createNotification(companyId, {
          type: 'overdue-alert',
          title: `${newlyOverdue.length} transacciones marcadas como vencidas`,
          summary: `Se detectaron ${newlyOverdue.length} transacciones pendientes por $${totalAmount.toLocaleString('es-CO')} que superan 30 días sin pago.`,
          data: {
            count: newlyOverdue.length,
            totalAmount,
            transactionIds: newlyOverdue.map((t) => t.id),
          },
        })

        console.log(`[OverdueCheck] Marked ${newlyOverdue.length} as overdue for company ${companyId}`)
      } catch (error) {
        console.error(`[OverdueCheck] Error for company ${companyId}:`, error)
      }
    }
  }
)
