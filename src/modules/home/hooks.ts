import { useMemo } from 'react'
import { useCollection } from '@/core/hooks/use-firestore'
import { useTransactions } from '@/modules/finance/hooks'
import { useClosings } from '@/modules/closings/hooks'
import { useCarteraItems, useCarteraSummary } from '@/modules/cartera/hooks'
import { useBudgetComparison } from '@/modules/finance/hooks'
import type { Transaction } from '@/modules/finance/types'
import type { Closing } from '@/modules/closings/types'
import type { Supplier } from '@/modules/suppliers/types'
import type { Contract } from '@/modules/contracts/types'
import type { CarteraItem } from '@/modules/cartera/types'
import type { BudgetComparisonRow } from '@/modules/finance/hooks'

// ─── Types ──────────────────────────────────────────────────────────

export interface DashboardKPIs {
  ventasHoy: number
  ventasHoyChange: string
  ventasHoyTrend: 'up' | 'down'
  gastosMes: number
  gastosMesChange: string
  gastosMesTrend: 'up' | 'down'
  margenNeto: number
  margenNetoChange: string
  margenNetoTrend: 'up' | 'down'
  porCobrar: number
  porCobrarChange: string
  porCobrarTrend: 'up' | 'down'
}

export interface SalesTrendPoint {
  date: string
  sales: number
}

export interface AlertItem {
  id: string
  label: string
  detail: string
}

export interface DashboardAlerts {
  overdueItems: AlertItem[]
  budgetExceeded: AlertItem[]
  expiringContracts: AlertItem[]
}

// ─── Helpers ────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatCurrencyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('es-CO')}`
}

function daysUntil(ts: any): number {
  const d = ts?.toDate?.() ?? (typeof ts === 'string' ? new Date(ts) : null)
  if (!d) return Infinity
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useDashboardData() {
  const { data: transactions, loading: txLoading } = useTransactions()
  const { data: closings, loading: closingsLoading } = useClosings()
  const { receivables, payables, loading: carteraLoading } = useCarteraItems()
  const { summary: carteraSummary } = useCarteraSummary()
  const { data: suppliers, loading: suppliersLoading } = useCollection<Supplier>('suppliers')
  const { data: contracts, loading: contractsLoading } = useCollection<Contract>('contracts')

  // Stabilize dates for useBudgetComparison
  const { monthStart, monthEnd } = useMemo(() => {
    const now = new Date()
    return {
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
      monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  }, [])

  const { comparison: budgetComparison, loading: budgetLoading } = useBudgetComparison(monthStart, monthEnd)

  // ─── KPIs ───────────────────────────────────────────────────────
  const kpis = useMemo<DashboardKPIs>(() => {
    const now = new Date()
    const todayStr = toDateStr(now)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = toDateStr(yesterday)

    // Ventas hoy: from closings
    const todayClosings = closings.filter((c) => c.date === todayStr)
    const yesterdayClosings = closings.filter((c) => c.date === yesterdayStr)
    let ventasHoy = todayClosings.reduce((s, c) => s + c.ventaTotal, 0)
    let ventasAyer = yesterdayClosings.reduce((s, c) => s + c.ventaTotal, 0)

    // Fallback to income transactions if no closings
    if (ventasHoy === 0 && todayClosings.length === 0) {
      ventasHoy = transactions
        .filter((t) => t.type === 'income' && toDateStr(t.date?.toDate?.() ?? new Date(0)) === todayStr)
        .reduce((s, t) => s + t.amount, 0)
    }
    if (ventasAyer === 0 && yesterdayClosings.length === 0) {
      ventasAyer = transactions
        .filter((t) => t.type === 'income' && toDateStr(t.date?.toDate?.() ?? new Date(0)) === yesterdayStr)
        .reduce((s, t) => s + t.amount, 0)
    }

    // Gastos del mes
    const msStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMsStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMsEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59, 59, 999)

    const gastosMes = transactions
      .filter((t) => {
        const d = t.date?.toDate?.()
        return d && t.type === 'expense' && d >= msStart && d <= now
      })
      .reduce((s, t) => s + t.amount, 0)

    const gastosMesPrev = transactions
      .filter((t) => {
        const d = t.date?.toDate?.()
        return d && t.type === 'expense' && d >= prevMsStart && d <= prevMsEnd
      })
      .reduce((s, t) => s + t.amount, 0)

    // Ingresos del mes (para margen)
    const ingresosMes = transactions
      .filter((t) => {
        const d = t.date?.toDate?.()
        return d && t.type === 'income' && d >= msStart && d <= now
      })
      .reduce((s, t) => s + t.amount, 0)

    const ingresosMesPrev = transactions
      .filter((t) => {
        const d = t.date?.toDate?.()
        return d && t.type === 'income' && d >= prevMsStart && d <= prevMsEnd
      })
      .reduce((s, t) => s + t.amount, 0)

    const margenNeto = ingresosMes > 0 ? ((ingresosMes - gastosMes) / ingresosMes) * 100 : 0
    const margenPrev = ingresosMesPrev > 0 ? ((ingresosMesPrev - gastosMesPrev) / ingresosMesPrev) * 100 : 0

    // Cuentas por cobrar
    const porCobrar = carteraSummary.totalReceivables
    const overdueCount = receivables.filter((r) => r.status === 'overdue').length

    return {
      ventasHoy,
      ventasHoyChange: pctChange(ventasHoy, ventasAyer),
      ventasHoyTrend: ventasHoy >= ventasAyer ? 'up' : 'down',
      gastosMes,
      gastosMesChange: pctChange(gastosMes, gastosMesPrev),
      gastosMesTrend: gastosMes <= gastosMesPrev ? 'up' : 'down',
      margenNeto,
      margenNetoChange: `${margenNeto.toFixed(1)}%`,
      margenNetoTrend: margenNeto >= margenPrev ? 'up' : 'down',
      porCobrar,
      porCobrarChange: overdueCount > 0 ? `${overdueCount} vencidas` : 'Al día',
      porCobrarTrend: overdueCount > 0 ? 'down' : 'up',
    }
  }, [transactions, closings, carteraSummary, receivables])

  // ─── Sales Trend (30 days) ──────────────────────────────────────
  const salesTrend = useMemo<SalesTrendPoint[]>(() => {
    const now = new Date()
    const points: SalesTrendPoint[] = []

    // Build a map of closings by date
    const closingsByDate = new Map<string, number>()
    for (const c of closings) {
      closingsByDate.set(c.date, (closingsByDate.get(c.date) ?? 0) + c.ventaTotal)
    }

    // Build a map of income transactions by date
    const txByDate = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'income') continue
      const d = t.date?.toDate?.()
      if (!d) continue
      const key = toDateStr(d)
      txByDate.set(key, (txByDate.get(key) ?? 0) + t.amount)
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = toDateStr(d)
      // Prefer closings, fallback to income transactions
      const sales = closingsByDate.get(dateStr) ?? txByDate.get(dateStr) ?? 0
      points.push({ date: formatShortDate(dateStr), sales })
    }

    return points
  }, [closings, transactions])

  // ─── Alerts ─────────────────────────────────────────────────────
  const alerts = useMemo<DashboardAlerts>(() => {
    // Overdue items
    const overdueItems: AlertItem[] = [
      ...receivables.filter((r) => r.status === 'overdue').map((r) => ({
        id: r.id,
        label: r.concept,
        detail: formatCurrencyShort(r.balance),
      })),
      ...payables.filter((p) => p.status === 'overdue').map((p) => ({
        id: p.id,
        label: p.concept,
        detail: formatCurrencyShort(p.balance),
      })),
    ]

    // Budget exceeded
    const budgetExceeded: AlertItem[] = budgetComparison.rows
      .filter((r) => r.type === 'expense' && r.budgeted > 0 && r.execution > 100)
      .map((r) => ({
        id: r.category,
        label: r.category,
        detail: `${r.execution.toFixed(0)}% del presupuesto`,
      }))

    // Expiring contracts (next 30 days)
    const expiringContracts: AlertItem[] = []

    for (const s of suppliers) {
      const days = daysUntil(s.contractEnd)
      if (days >= 0 && days <= 30 && s.status === 'active') {
        expiringContracts.push({
          id: s.id,
          label: s.name,
          detail: days === 0 ? 'Vence hoy' : `Vence en ${days} días`,
        })
      }
    }

    for (const c of contracts) {
      if (c.status !== 'active' || !c.endDate) continue
      const days = daysUntil(c.endDate)
      if (days >= 0 && days <= 30) {
        expiringContracts.push({
          id: c.id,
          label: `${c.employeeName} — ${c.position}`,
          detail: days === 0 ? 'Vence hoy' : `Vence en ${days} días`,
        })
      }
    }

    return { overdueItems, budgetExceeded, expiringContracts }
  }, [receivables, payables, budgetComparison, suppliers, contracts])

  const loading = txLoading || closingsLoading || carteraLoading || budgetLoading || suppliersLoading || contractsLoading

  return { kpis, salesTrend, alerts, loading }
}
