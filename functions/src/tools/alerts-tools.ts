import { tool } from 'ai'
import { z } from 'zod'
import { fetchCollection, fetchSettingsDoc } from '../firestore.js'

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

export interface Alert {
  type: 'warning' | 'danger' | 'info'
  category: string
  message: string
  details?: Record<string, unknown>
}

// ─── Tools ───

export function createAlertsTools(companyId: string) {
  return {
    getBusinessAlerts: tool({
      description:
        'Genera alertas proactivas del negocio: contratos por vencer, empleados en período de prueba, presupuesto excedido, transacciones vencidas, proveedores con contratos expirados.',
      parameters: z.object({
        daysAhead: z.number().optional().default(30).describe('Días a futuro para alertas de vencimiento (default: 30)'),
      }),
      execute: async ({ daysAhead }) => {
        const [employees, suppliers, contracts, transactions, budgetDoc] = await Promise.all([
          fetchCollection(companyId, 'employees'),
          fetchCollection(companyId, 'suppliers'),
          fetchCollection(companyId, 'contracts'),
          fetchCollection(companyId, 'transactions'),
          fetchSettingsDoc(companyId, 'budget'),
        ])

        const now = new Date()
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + daysAhead)
        const alerts: Alert[] = []

        // 1. Contratos de empleados por vencer
        for (const c of contracts) {
          const end = tsToDate(c.endDate)
          if (end && end >= now && end <= futureDate) {
            const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            alerts.push({
              type: daysLeft <= 7 ? 'danger' : 'warning',
              category: 'Contratos',
              message: `Contrato de ${c.employeeName || c.title} vence en ${daysLeft} días (${tsToIso(c.endDate)})`,
              details: { contractId: c.id, employeeName: c.employeeName, endDate: tsToIso(c.endDate) },
            })
          }
          // Already expired
          if (end && end < now) {
            alerts.push({
              type: 'danger',
              category: 'Contratos',
              message: `Contrato de ${c.employeeName || c.title} ya venció el ${tsToIso(c.endDate)}`,
              details: { contractId: c.id, employeeName: c.employeeName, endDate: tsToIso(c.endDate) },
            })
          }
        }

        // 2. Empleados en período de prueba (primeros 90 días)
        for (const emp of employees) {
          if (emp.status !== 'active') continue
          const start = tsToDate(emp.startDate)
          if (!start) continue
          const probationEnd = new Date(start)
          probationEnd.setDate(probationEnd.getDate() + 90)
          if (probationEnd >= now && probationEnd <= futureDate) {
            const daysLeft = Math.ceil((probationEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            alerts.push({
              type: 'info',
              category: 'Empleados',
              message: `Período de prueba de ${emp.name} termina en ${daysLeft} días`,
              details: { employeeId: emp.id, name: emp.name, probationEnd: tsToIso(probationEnd) },
            })
          }
        }

        // 3. Proveedores con contrato expirado o por vencer
        for (const s of suppliers) {
          if (s.status === 'expired') continue
          const end = tsToDate(s.contractEnd)
          if (!end) continue
          if (end < now) {
            alerts.push({
              type: 'danger',
              category: 'Proveedores',
              message: `Contrato de ${s.name} expiró el ${tsToIso(s.contractEnd)}`,
              details: { supplierId: s.id, name: s.name },
            })
          } else if (end <= futureDate) {
            const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            alerts.push({
              type: 'warning',
              category: 'Proveedores',
              message: `Contrato de ${s.name} vence en ${daysLeft} días`,
              details: { supplierId: s.id, name: s.name, contractEnd: tsToIso(s.contractEnd) },
            })
          }
        }

        // 4. Transacciones vencidas (overdue)
        const overdue = transactions.filter((t) => t.status === 'overdue')
        if (overdue.length > 0) {
          const totalOverdue = overdue.reduce((s, t) => s + (Number(t.amount) || 0), 0)
          alerts.push({
            type: 'danger',
            category: 'Finanzas',
            message: `${overdue.length} transacciones vencidas por un total de $${totalOverdue.toLocaleString()}`,
            details: { count: overdue.length, totalAmount: totalOverdue },
          })
        }

        // 5. Transacciones pendientes
        const pending = transactions.filter((t) => t.status === 'pending')
        if (pending.length > 0) {
          const totalPending = pending.reduce((s, t) => s + (Number(t.amount) || 0), 0)
          alerts.push({
            type: 'info',
            category: 'Finanzas',
            message: `${pending.length} transacciones pendientes por $${totalPending.toLocaleString()}`,
            details: { count: pending.length, totalAmount: totalPending },
          })
        }

        // 6. Presupuesto excedido (mes actual)
        const budgetItems = (budgetDoc?.items as Array<{ category: string; type: string; amount: number }>) ?? []
        if (budgetItems.length > 0) {
          const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
          const monthEnd = now.toISOString().split('T')[0]
          const startD = new Date(monthStart)
          const endD = new Date(monthEnd)
          endD.setHours(23, 59, 59, 999)

          const monthTxs = transactions.filter((t) => {
            const d = tsToDate(t.date)
            return d && d >= startD && d <= endD
          })

          // Group actuals by category+type
          const actualMap = new Map<string, number>()
          for (const t of monthTxs) {
            const key = `${t.category}|${t.type}`
            actualMap.set(key, (actualMap.get(key) ?? 0) + (Number(t.amount) || 0))
          }

          for (const item of budgetItems) {
            if (item.type !== 'expense' || item.amount <= 0) continue
            const actual = actualMap.get(`${item.category}|${item.type}`) ?? 0
            const execution = (actual / item.amount) * 100
            if (execution > 100) {
              alerts.push({
                type: 'danger',
                category: 'Presupuesto',
                message: `${item.category}: gasto de $${actual.toLocaleString()} excede presupuesto de $${item.amount.toLocaleString()} (${Math.round(execution)}%)`,
                details: { budgetCategory: item.category, budgeted: item.amount, actual, executionPercent: Math.round(execution) },
              })
            } else if (execution > 85) {
              alerts.push({
                type: 'warning',
                category: 'Presupuesto',
                message: `${item.category}: al ${Math.round(execution)}% del presupuesto ($${actual.toLocaleString()} de $${item.amount.toLocaleString()})`,
                details: { budgetCategory: item.category, budgeted: item.amount, actual, executionPercent: Math.round(execution) },
              })
            }
          }
        }

        // Sort: danger first, then warning, then info
        const priority: Record<string, number> = { danger: 0, warning: 1, info: 2 }
        alerts.sort((a, b) => (priority[a.type] ?? 3) - (priority[b.type] ?? 3))

        return {
          totalAlerts: alerts.length,
          dangerCount: alerts.filter((a) => a.type === 'danger').length,
          warningCount: alerts.filter((a) => a.type === 'warning').length,
          infoCount: alerts.filter((a) => a.type === 'info').length,
          alerts,
        }
      },
    }),
  }
}
