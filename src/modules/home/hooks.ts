import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import { useCollection } from '@/core/hooks/use-firestore'
import { useTransactions, classifyExpense } from '@/modules/finance/hooks'
import { useClosings } from '@/modules/closings/hooks'
import { useCarteraItems, useCarteraSummary } from '@/modules/cartera/hooks'
import { useBudgetComparison } from '@/modules/finance/hooks'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import { triggerServerReconcile } from '@/modules/pos-sync/services'
import { useCompany } from '@/core/hooks/use-company'
import {
  isAnulada,
  ventaMonto,
  cajaKey,
  toDateStrLocal,
} from '@/modules/pos-sync/utils/sales-calculations'
import { useHomeFilters } from './context/home-filters-context'
import type { Supplier } from '@/modules/suppliers/types'
import type { Contract } from '@/modules/contracts/types'

// ─── Types ──────────────────────────────────────────────────────────

export interface DashboardKPIs {
  ventasHoy: number
  ventasHoyChange: string
  ventasHoyTrend: 'up' | 'down'
  gastosMes: number
  gastosMesChange: string
  gastosMesTrend: 'up' | 'down'
  costo: number
  costoChange: string
  costoTrend: 'up' | 'down'
  porCobrar: number
  porCobrarChange: string
  porCobrarTrend: 'up' | 'down' | 'neutral'
}

export interface SalesTrendPoint {
  date: string
  sales: number
}

export interface DashboardProjection {
  applicable: boolean
  projected: number
  mtd: number
  daysElapsed: number
  daysInMonth: number
  daysRemaining: number
  deltaVsLastMonth: string
  deltaTrend: 'up' | 'down' | 'neutral'
  lastMonthTotal: number
  dailyAverage: number
  futurePoints: SalesTrendPoint[]
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

export interface DashboardSyncStatus {
  loading: boolean
  lastUpdated: Date | null
  fromCache: boolean
  hasLocals: boolean
  onRefresh?: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────

const toDateStr = toDateStrLocal

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

function buildComparisonLabel(activePreset: string, prevStart: Date): string {
  switch (activePreset) {
    case 'today':
      return 'vs Ayer'
    case 'yesterday':
      return 'vs Anteayer'
    case 'last7':
      return 'vs 7 días previos'
    case 'last30':
      return 'vs 30 días previos'
    case 'thisWeek':
      return 'vs Semana anterior'
    case 'lastWeek':
      return 'vs Semana previa'
    case 'thisMonth':
    case 'lastMonth': {
      const month = prevStart.toLocaleDateString('es-CO', { month: 'long' })
      const capitalized = month.charAt(0).toUpperCase() + month.slice(1)
      return `vs ${capitalized}`
    }
    case 'yearToDate':
      return 'vs Año anterior'
    default:
      return 'vs Período anterior'
  }
}

function daysUntil(ts: any): number {
  const d = ts?.toDate?.() ?? (typeof ts === 'string' ? new Date(ts) : null)
  if (!d) return Infinity
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useDashboardData() {
  const { startDate, endDate, activePreset } = useDateRange()
  const { selectedCaja, setSelectedCaja } = useHomeFilters()
  const { selectedCompany } = useCompany()
  const { data: transactions, loading: txLoading } = useTransactions()
  const { data: closings, loading: closingsLoading } = useClosings()
  const { receivables, payables, loading: carteraLoading } = useCarteraItems()
  const { summary: carteraSummary } = useCarteraSummary()
  const { data: suppliers, loading: suppliersLoading } = useCollection<Supplier>('suppliers')
  const { data: contracts, loading: contractsLoading } = useCollection<Contract>('contracts')
  const { localIds, loading: localIdsLoading } = useCompanyLocalIds()

  // Previous period of equal duration for comparison
  const { prevStart, prevEnd } = useMemo(() => {
    const durationMs = endDate.getTime() - startDate.getTime()
    return {
      prevStart: new Date(startDate.getTime() - durationMs - 1),
      prevEnd: new Date(startDate.getTime() - 1),
    }
  }, [startDate, endDate])

  // POS ventas para [prevStart, endDate] — se aplican como fuente primaria de ventas.
  // Para preset "thisMonth" extendemos al 1° del mes anterior: la proyección de fin
  // de mes compara contra el mes anterior COMPLETO, y si `prevStart` cae dentro de
  // ese mes (p.ej. hoy 19-abr → prevStart ≈ 13-mar), `lastMonthTotal` quedaba
  // truncado (sumaba solo 13–31 marzo en vez de 1–31 marzo) y la delta salía inflada.
  const posRangeStart = useMemo(() => {
    if (activePreset === 'thisMonth') {
      const now = new Date()
      const lastMonthFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const earlier = lastMonthFirst < prevStart ? lastMonthFirst : prevStart
      return toDateStr(earlier)
    }
    return toDateStr(prevStart)
  }, [prevStart, activePreset])
  const posRangeEnd = useMemo(() => toDateStr(endDate), [endDate])
  const {
    ventas: posVentas,
    loading: posLoading,
    isPending: posIsPending,
    lastUpdated: posLastUpdated,
    fromCache: posFromCache,
    forceRefresh: posForceRefresh,
    refetch: posRefetch,
  } = usePosVentas({
    localIds,
    startDate: posRangeStart,
    endDate: posRangeEnd,
    enabled: localIds.length > 0,
  })

  // Solo skeleton en la primera carga sin data/placeholder. Antes usábamos
  // `posLoading && posVentas.length === 0` que mantenía el skeleton eterno
  // cuando un chunk fallaba (queryFn terminaba en error y data quedaba vacía).
  // Incluimos `localIdsLoading` para evitar el flash datos→skeleton→datos:
  // `useCompanyLocalIds` resuelve después de las queries Firestore, por lo
  // que el skeleton se apagaba brevemente antes de que la query POS se
  // habilitara. Mantenemos el skeleton hasta saber si hay locales.
  const posColdLoading = localIdsLoading || (posIsPending && localIds.length > 0)

  // Suma de ventas POS válidas (excluye anuladas) agrupadas por día YYYY-MM-DD.
  // Solo el total neto del comprobante — así cuadra 1:1 con el reporte del POS
  // de restaurant.pe, que también reporta solo neto. Propinas y envío se muestran
  // como desglose aparte en cajaBreakdown/cajasOverview pero no se suman al KPI.
  const posSalesByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of posVentas) {
      if (isAnulada(v)) continue
      if (selectedCaja !== 'todas' && cajaKey(v) !== selectedCaja) continue
      const date = v.fecha?.slice(0, 10)
      if (!date) continue
      map.set(date, (map.get(date) ?? 0) + ventaMonto(v))
    }
    return map
  }, [posVentas, selectedCaja])

  // Auto-reconcile histórico: si el usuario carga un rango que se extiende más
  // allá de la ventana del cron (32 días) y el cache muestra huecos, disparar
  // `posReconcileOnDemand` una vez para rellenar hasta 365 días hacia atrás.
  // El callable tiene cooldown server-side de 1 min, así que es seguro llamarlo
  // de forma optimista — si ya corrió recientemente, el server rechaza sin costo.
  // Circuit breaker: si un fireKey falló recientemente (CORS, 500, network),
  // esperar RECONCILE_FAILURE_COOLDOWN_MS antes de reintentar. Evita loops
  // infinitos cuando el fallo es determinista.
  const RECONCILE_FAILURE_COOLDOWN_MS = 5 * 60 * 1000
  const reconcileFiredRef = useRef<string | null>(null)
  const firingRef = useRef(false)
  const failedAtRef = useRef<Map<string, number>>(new Map())
  const [reconcilingHistoric, setReconcilingHistoric] = useState(false)
  const [reconcileError, setReconcileError] = useState<string | null>(null)
  const [forceReconcileTick, setForceReconcileTick] = useState(0)

  const runReconcile = useCallback(
    async (days: number, fireKey: string, label: string) => {
      if (!selectedCompany?.id) return
      firingRef.current = true
      setReconcilingHistoric(true)
      setReconcileError(null)
      try {
        await triggerServerReconcile(selectedCompany.id, days)
        reconcileFiredRef.current = fireKey
        failedAtRef.current.delete(fireKey)
        await posRefetch()
      } catch (err) {
        failedAtRef.current.set(fireKey, Date.now())
        const msg = err instanceof Error ? err.message : String(err)
        setReconcileError(`${label}: ${msg}`)
        // eslint-disable-next-line no-console
        console.warn('[home] reconcile histórico falló', err)
      } finally {
        firingRef.current = false
        setReconcilingHistoric(false)
      }
    },
    [selectedCompany?.id, posRefetch],
  )

  useEffect(() => {
    if (!selectedCompany?.id) return
    if (localIds.length === 0) return
    if (posLoading || posColdLoading) return

    const startStr = toDateStr(startDate)
    const endStr = toDateStr(endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const msPerDay = 1000 * 60 * 60 * 24
    const daysInRange = Math.max(
      1,
      Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1,
    )
    const daysAgoStart = Math.floor((today.getTime() - startDate.getTime()) / msPerDay)
    if (daysAgoStart <= 32) return

    const daysWithSales = new Set<string>()
    for (const v of posVentas) {
      if (isAnulada(v)) continue
      const date = v.fecha?.slice(0, 10)
      if (!date || date < startStr || date > endStr) continue
      daysWithSales.add(date)
    }
    const coverage = daysWithSales.size / daysInRange
    if (coverage >= 0.7) return

    const fireKey = `${selectedCompany.id}_${startStr}_${endStr}`
    if (reconcileFiredRef.current === fireKey && forceReconcileTick === 0) return
    if (firingRef.current) return
    const failedAt = failedAtRef.current.get(fireKey)
    if (failedAt && Date.now() - failedAt < RECONCILE_FAILURE_COOLDOWN_MS) return

    const reconcileDays = Math.min(Math.max(daysAgoStart, 32), 365)
    void runReconcile(reconcileDays, fireKey, `Reconcile auto (${reconcileDays}d)`)
  }, [
    selectedCompany?.id,
    localIds.length,
    posLoading,
    posColdLoading,
    posVentas,
    startDate,
    endDate,
    forceReconcileTick,
    runReconcile,
  ])

  // Acción manual para el usuario: reintento del reconcile cuando falló
  // (limpia el circuit breaker y dispara de nuevo).
  const retryReconcile = useCallback(() => {
    if (!selectedCompany?.id || firingRef.current) return
    const startStr = toDateStr(startDate)
    const endStr = toDateStr(endDate)
    const fireKey = `${selectedCompany.id}_${startStr}_${endStr}`
    failedAtRef.current.delete(fireKey)
    reconcileFiredRef.current = null
    setForceReconcileTick((t) => t + 1)
  }, [selectedCompany?.id, startDate, endDate])

  // Polling al flag `inProgress` del server. Usamos getDoc con setInterval
  // en vez de onSnapshot porque varios adblockers bloquean el endpoint
  // `firestore.googleapis.com/.../channel` que usa el long-poll de
  // onSnapshot (ERR_BLOCKED_BY_CLIENT). `getDoc` va por REST y no lo
  // bloquean. 30s de latencia es trivial para reconciles que tardan
  // 15-40 min.
  useEffect(() => {
    if (!selectedCompany?.id) return
    const ref = doc(
      db,
      'companies',
      selectedCompany.id,
      'settings',
      'pos-reconcile-meta',
    )
    let cancelled = false
    let prevInProgress = false
    let pollFailures = 0
    const MAX_POLL_FAILURES = 3

    const poll = async () => {
      if (cancelled) return
      try {
        const snap = await getDoc(ref)
        pollFailures = 0
        if (cancelled) return
        if (!snap.exists()) {
          prevInProgress = false
          return
        }
        const data = snap.data() as { inProgress?: boolean; startedAt?: Timestamp }
        const startedMs = data.startedAt?.toMillis?.() ?? 0
        const stuck = startedMs > 0 && Date.now() - startedMs > 60 * 60 * 1000
        const active = !!data.inProgress && !stuck
        setReconcilingHistoric((prev) => (firingRef.current ? prev : active))
        if (prevInProgress && !active) {
          posRefetch()
        }
        prevInProgress = active
      } catch {
        // Si el getDoc falla N veces consecutivas (adblocker, offline, reglas),
        // asumir que no podemos coordinar y quitar el banner — peor que el
        // usuario vea datos sin saber que hay reconcile corriendo que que
        // quede mirando "Rellenando históricos..." para siempre.
        pollFailures += 1
        if (pollFailures >= MAX_POLL_FAILURES && !firingRef.current) {
          setReconcilingHistoric(false)
          prevInProgress = false
        }
      }
    }

    poll()
    const id = setInterval(poll, 30 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedCompany?.id, posRefetch])

  // Cajas disponibles dentro del rango visible [startDate..endDate]
  const cajasDisponibles = useMemo<Array<[string, number]>>(() => {
    const startStr = toDateStr(startDate)
    const endStr = toDateStr(endDate)
    const counts = new Map<string, number>()
    for (const v of posVentas) {
      if (isAnulada(v)) continue
      const date = v.fecha?.slice(0, 10)
      if (!date || date < startStr || date > endStr) continue
      counts.set(cajaKey(v), (counts.get(cajaKey(v)) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [posVentas, startDate, endDate])

  // Auto-reset si la caja seleccionada sale del set disponible
  useEffect(() => {
    if (selectedCaja === 'todas') return
    if (!cajasDisponibles.some(([k]) => k === selectedCaja)) setSelectedCaja('todas')
  }, [cajasDisponibles, selectedCaja, setSelectedCaja])

  function sumPosBetween(startStr: string, endStr: string): number {
    let sum = 0
    for (const [date, value] of posSalesByDate) {
      if (date >= startStr && date <= endStr) sum += value
    }
    return sum
  }

  function hasPosBetween(startStr: string, endStr: string): boolean {
    for (const date of posSalesByDate.keys()) {
      if (date >= startStr && date <= endStr) return true
    }
    return false
  }

  // Stabilize dates for useBudgetComparison
  const { monthStart, monthEnd } = useMemo(() => {
    const now = new Date()
    return {
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
      monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  }, [])

  const { comparison: budgetComparison, loading: budgetLoading } = useBudgetComparison(monthStart, monthEnd)

  // ─── KPIs (filtered by date range) ─────────────────────────────
  const kpis = useMemo<DashboardKPIs>(() => {
    const startStr = toDateStr(startDate)
    const endStr = toDateStr(endDate)
    const prevStartStr = toDateStr(prevStart)
    const prevEndStr = toDateStr(prevEnd)

    // Ventas del período — precedencia: POS (cache + hoy en vivo) → closings → income transactions
    let ventas = 0
    let ventasPrev = 0

    if (hasPosBetween(startStr, endStr)) {
      ventas = sumPosBetween(startStr, endStr)
    } else {
      const periodClosings = closings.filter((c) => c.date >= startStr && c.date <= endStr)
      ventas = periodClosings.reduce((s, c) => s + c.ventaTotal, 0)
      if (ventas === 0 && periodClosings.length === 0) {
        ventas = transactions
          .filter((t) => {
            const d = t.date?.toDate?.()
            return d && t.type === 'income' && d >= startDate && d <= endDate
          })
          .reduce((s, t) => s + t.amount, 0)
      }
    }

    if (hasPosBetween(prevStartStr, prevEndStr)) {
      ventasPrev = sumPosBetween(prevStartStr, prevEndStr)
    } else {
      const prevClosings = closings.filter((c) => c.date >= prevStartStr && c.date <= prevEndStr)
      ventasPrev = prevClosings.reduce((s, c) => s + c.ventaTotal, 0)
      if (ventasPrev === 0 && prevClosings.length === 0) {
        ventasPrev = transactions
          .filter((t) => {
            const d = t.date?.toDate?.()
            return d && t.type === 'income' && d >= prevStart && d <= prevEnd
          })
          .reduce((s, t) => s + t.amount, 0)
      }
    }

    // Gastos del período
    const gastos = transactions
      .filter((t) => {
        const d = t.date?.toDate?.()
        return d && t.type === 'expense' && d >= startDate && d <= endDate
      })
      .reduce((s, t) => s + t.amount, 0)

    const gastosPrev = transactions
      .filter((t) => {
        const d = t.date?.toDate?.()
        return d && t.type === 'expense' && d >= prevStart && d <= prevEnd
      })
      .reduce((s, t) => s + t.amount, 0)

    // Costo de ventas del período (PUC clase 6: insumos, suministros, costo de ventas)
    const costo = transactions
      .filter((t) => {
        const d = t.date?.toDate?.()
        return (
          d &&
          t.type === 'expense' &&
          classifyExpense(t.category) === 'cost_of_sales' &&
          d >= startDate &&
          d <= endDate
        )
      })
      .reduce((s, t) => s + t.amount, 0)

    const costoPrev = transactions
      .filter((t) => {
        const d = t.date?.toDate?.()
        return (
          d &&
          t.type === 'expense' &&
          classifyExpense(t.category) === 'cost_of_sales' &&
          d >= prevStart &&
          d <= prevEnd
        )
      })
      .reduce((s, t) => s + t.amount, 0)

    // Cuentas por cobrar (estado actual, no depende del filtro)
    const porCobrar = carteraSummary.totalReceivables
    const overdueCount = receivables.filter((r) => r.status === 'overdue').length

    return {
      ventasHoy: ventas,
      ventasHoyChange: pctChange(ventas, ventasPrev),
      ventasHoyTrend: ventas >= ventasPrev ? 'up' : 'down',
      gastosMes: gastos,
      gastosMesChange: pctChange(gastos, gastosPrev),
      gastosMesTrend: gastos >= gastosPrev ? 'up' : 'down',
      costo,
      costoChange: pctChange(costo, costoPrev),
      costoTrend: costo >= costoPrev ? 'up' : 'down',
      porCobrar,
      porCobrarChange: overdueCount > 0 ? `${overdueCount} vencidas` : porCobrar > 0 ? `${receivables.filter((r) => r.status === 'pending').length} pendientes` : 'Al día',
      porCobrarTrend: overdueCount > 0 ? 'down' : porCobrar > 0 ? 'neutral' : 'up',
    }
  }, [transactions, closings, posSalesByDate, carteraSummary, receivables, startDate, endDate, prevStart, prevEnd])

  // ─── Sales Trend (filtered by date range) ──────────────────────
  const salesTrend = useMemo<SalesTrendPoint[]>(() => {
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

    // Iterate each day in the selected range — POS toma precedencia sobre closings/transactions
    const current = new Date(startDate)
    current.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)

    while (current <= end) {
      const dateStr = toDateStr(current)
      const sales =
        posSalesByDate.get(dateStr) ?? closingsByDate.get(dateStr) ?? txByDate.get(dateStr) ?? 0
      points.push({ date: formatShortDate(dateStr), sales })
      current.setDate(current.getDate() + 1)
    }

    return points
  }, [closings, transactions, posSalesByDate, startDate, endDate])

  // ─── Month-end projection (solo aplicable cuando preset = thisMonth) ──
  const projection = useMemo<DashboardProjection>(() => {
    const empty: DashboardProjection = {
      applicable: false,
      projected: 0,
      mtd: 0,
      daysElapsed: 0,
      daysInMonth: 0,
      daysRemaining: 0,
      deltaVsLastMonth: '0%',
      deltaTrend: 'neutral',
      lastMonthTotal: 0,
      dailyAverage: 0,
      futurePoints: [],
    }

    if (activePreset !== 'thisMonth') return empty

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const year = today.getFullYear()
    const month = today.getMonth()
    const monthFirst = new Date(year, month, 1)
    const monthLast = new Date(year, month + 1, 0)
    const daysInMonth = monthLast.getDate()
    const dayOfMonth = today.getDate()

    const monthStartStr = toDateStr(monthFirst)
    const mtdEndStr = toDateStr(today)

    // MTD: usa la misma precedencia que kpis (POS → closings → transactions)
    let mtd = 0
    if (hasPosBetween(monthStartStr, mtdEndStr)) {
      mtd = sumPosBetween(monthStartStr, mtdEndStr)
    } else {
      const mtdClosings = closings.filter(
        (c) => c.date >= monthStartStr && c.date <= mtdEndStr,
      )
      mtd = mtdClosings.reduce((s, c) => s + c.ventaTotal, 0)
      if (mtd === 0 && mtdClosings.length === 0) {
        mtd = transactions
          .filter((t) => {
            const d = t.date?.toDate?.()
            return d && t.type === 'income' && d >= monthFirst && d <= today
          })
          .reduce((s, t) => s + t.amount, 0)
      }
    }

    // Mes anterior completo — para comparar el proyectado
    const lastMonthStart = new Date(year, month - 1, 1)
    const lastMonthEnd = new Date(year, month, 0)
    const lastMonthStartStr = toDateStr(lastMonthStart)
    const lastMonthEndStr = toDateStr(lastMonthEnd)
    let lastMonthTotal = 0
    if (hasPosBetween(lastMonthStartStr, lastMonthEndStr)) {
      lastMonthTotal = sumPosBetween(lastMonthStartStr, lastMonthEndStr)
    } else {
      const lmClosings = closings.filter(
        (c) => c.date >= lastMonthStartStr && c.date <= lastMonthEndStr,
      )
      lastMonthTotal = lmClosings.reduce((s, c) => s + c.ventaTotal, 0)
      if (lastMonthTotal === 0 && lmClosings.length === 0) {
        lastMonthTotal = transactions
          .filter((t) => {
            const d = t.date?.toDate?.()
            return (
              d && t.type === 'income' && d >= lastMonthStart && d <= lastMonthEnd
            )
          })
          .reduce((s, t) => s + t.amount, 0)
      }
    }

    const daysElapsed = Math.min(dayOfMonth, daysInMonth)
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed)

    // Umbral: necesitamos al menos 3 días con datos y MTD > 0
    if (daysElapsed < 3 || mtd <= 0) return empty

    const dailyAverage = mtd / daysElapsed
    const projected = mtd + dailyAverage * daysRemaining

    const deltaVsLastMonth =
      lastMonthTotal > 0 ? pctChange(projected, lastMonthTotal) : 'n/d'
    const deltaTrend: 'up' | 'down' | 'neutral' =
      lastMonthTotal <= 0
        ? 'neutral'
        : projected >= lastMonthTotal
          ? 'up'
          : 'down'

    // Puntos proyectados: día siguiente a hoy hasta fin de mes
    const futurePoints: SalesTrendPoint[] = []
    const cursor = new Date(today)
    cursor.setDate(cursor.getDate() + 1)
    while (cursor <= monthLast) {
      futurePoints.push({
        date: formatShortDate(toDateStr(cursor)),
        sales: dailyAverage,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    return {
      applicable: true,
      projected,
      mtd,
      daysElapsed,
      daysInMonth,
      daysRemaining,
      deltaVsLastMonth,
      deltaTrend,
      lastMonthTotal,
      dailyAverage,
      futurePoints,
    }
  }, [activePreset, closings, transactions, posSalesByDate])

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
      if (s.status !== 'active' || !s.contractEnd) continue
      const days = daysUntil(s.contractEnd)
      if (days >= 0 && days <= 30) {
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

  const loading =
    txLoading ||
    closingsLoading ||
    carteraLoading ||
    budgetLoading ||
    suppliersLoading ||
    contractsLoading ||
    posColdLoading

  const syncStatus = useMemo<DashboardSyncStatus>(
    () => ({
      loading: posLoading,
      lastUpdated: posLastUpdated,
      fromCache: posFromCache,
      hasLocals: localIds.length > 0,
      onRefresh: () => {
        posForceRefresh()
      },
    }),
    [posLoading, posLastUpdated, posFromCache, localIds.length, posForceRefresh],
  )

  const comparisonLabel = useMemo(
    () => buildComparisonLabel(activePreset, prevStart),
    [activePreset, prevStart],
  )

  // Lee el último run del cron nocturno para mostrar al usuario si ha estado
  // corriendo con éxito. `reports/pos-reconcile/runs/{YYYY-MM-DD}` es escrito
  // por `runReconcile` en functions/src/pos-reconcile.ts.
  const [lastCronRun, setLastCronRun] = useState<{
    date: string
    ventasWritten: number
    hadErrors: boolean
    finishedAt: Date | null
  } | null>(null)
  useEffect(() => {
    let cancelled = false
    const fetchLastRun = async () => {
      try {
        // Intentamos hoy y ayer: el cron corre 01:00 BOG, así que si el
        // usuario abre Home a las 08:00 debería existir el doc de hoy;
        // si abre a las 23:00 del día anterior al cron, leemos el de ayer.
        const today = new Date()
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        for (const d of [today, yesterday]) {
          const date = fmt(d)
          const ref = doc(db, 'reports', 'pos-reconcile', 'runs', date)
          const snap = await getDoc(ref)
          if (cancelled) return
          if (!snap.exists()) continue
          const data = snap.data() as {
            ventasWritten?: number
            perCompany?: Array<{ error?: string; rateLimited?: boolean }>
            finishedAt?: Timestamp
          }
          const hadErrors =
            !!data.perCompany?.some((c) => c.error || c.rateLimited)
          setLastCronRun({
            date,
            ventasWritten: data.ventasWritten ?? 0,
            hadErrors,
            finishedAt: data.finishedAt?.toDate?.() ?? null,
          })
          return
        }
      } catch {
        // Silencioso: si Firestore falla (adblocker, offline), ocultamos el
        // indicador — no es crítico que el usuario vea el estado del cron.
      }
    }
    fetchLastRun()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    kpis,
    salesTrend,
    alerts,
    loading,
    syncStatus,
    cajasDisponibles,
    comparisonLabel,
    reconcilingHistoric,
    reconcileError,
    retryReconcile,
    lastCronRun,
    projection,
  }
}
