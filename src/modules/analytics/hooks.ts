import { useMemo } from 'react'
import { useCollection } from '@/core/hooks/use-firestore'
import { useSettings } from '@/core/hooks/use-settings'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import { useTransactionsInRange } from '@/modules/finance/hooks'
import { usePurchasesInRange } from '@/modules/purchases/hooks'
import {
  calcTotals,
  isAnulada,
  toDateStrLocal,
  num,
  type PosTotals,
} from '@/modules/pos-sync/utils/sales-calculations'
import { getCostGroup, COST_GROUP_LABELS, calcChange, getMonthsBetween } from './services'
import type { Employee } from '@/modules/talent/types'
import type {
  AnalyticsKPIs,
  CostStructureKPIs,
  PurchaseAnalyticsKPIs,
  PayrollKPIs,
  CategoryCost,
  MonthlyDataPoint,
  MonthlyCostPoint,
  SupplierData,
  ProductData,
  DepartmentPayroll,
  RolePayroll,
} from './types'

function toDate(ts: any): Date {
  return ts?.toDate?.() ?? new Date(0)
}

function inRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d <= end
}

/** Compute a "previous period" of the same length ending right before `start` */
function getPreviousPeriod(start: Date, end: Date): { prevStart: Date; prevEnd: Date } {
  const diff = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - diff)
  return { prevStart, prevEnd }
}

// ─── General KPIs ────────────────────────────────────────────────────

export function useAnalyticsKPIs(): { kpis: AnalyticsKPIs; loading: boolean } {
  const { startDate, endDate } = useDateRange()
  // Acota el fetch a [prevStart..endDate]: cubre el período actual y el
  // anterior (para comparativos) en una sola query. Antes se leía la
  // colección entera y se filtraba in-memory.
  const { prevStart } = useMemo(() => getPreviousPeriod(startDate, endDate), [startDate, endDate])
  const { data: transactions, loading: txLoading } = useTransactionsInRange(prevStart, endDate)
  const { data: purchases, loading: purLoading } = usePurchasesInRange(prevStart, endDate)

  const loading = txLoading || purLoading

  const kpis = useMemo<AnalyticsKPIs>(() => {
    const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate)

    const inRangeTx = transactions.filter((t) => inRange(toDate(t.date), startDate, endDate))
    const prevTx = transactions.filter((t) => inRange(toDate(t.date), prevStart, prevEnd))

    const income = inRangeTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = inRangeTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const prevIncome = prevTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const prevExpenses = prevTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const inRangePur = purchases.filter((p) => inRange(toDate(p.date), startDate, endDate))
    const prevPur = purchases.filter((p) => inRange(toDate(p.date), prevStart, prevEnd))
    const purTotal = inRangePur.reduce((s, p) => s + p.total, 0)
    const prevPurTotal = prevPur.reduce((s, p) => s + p.total, 0)

    const netProfit = income - expenses
    const prevProfit = prevIncome - prevExpenses
    const margin = income > 0 ? (netProfit / income) * 100 : 0
    const prevMargin = prevIncome > 0 ? (prevProfit / prevIncome) * 100 : 0

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netProfit,
      profitMargin: margin,
      totalPurchases: purTotal,
      incomeChange: calcChange(income, prevIncome),
      expenseChange: calcChange(expenses, prevExpenses),
      profitChange: calcChange(netProfit, prevProfit),
      marginChange: calcChange(margin, prevMargin),
      purchaseChange: calcChange(purTotal, prevPurTotal),
    }
  }, [transactions, purchases, startDate, endDate])

  return { kpis, loading }
}

// ─── Monthly breakdown (for general charts) ──────────────────────────

export function useMonthlyBreakdown(): { data: MonthlyDataPoint[]; loading: boolean } {
  const { startDate, endDate } = useDateRange()
  const { data: transactions, loading: txLoading } = useTransactionsInRange(startDate, endDate)
  const { data: purchases, loading: purLoading } = usePurchasesInRange(startDate, endDate)

  const loading = txLoading || purLoading

  const data = useMemo<MonthlyDataPoint[]>(() => {
    const months = getMonthsBetween(startDate, endDate)
    const map: Record<string, MonthlyDataPoint> = {}
    months.forEach((m) => {
      map[m.key] = { month: m.label, income: 0, expenses: 0, purchases: 0 }
    })

    transactions.forEach((t) => {
      const d = toDate(t.date)
      if (!inRange(d, startDate, endDate)) return
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map[key]) return
      if (t.type === 'income') map[key].income += t.amount
      else map[key].expenses += t.amount
    })

    purchases.forEach((p) => {
      const d = toDate(p.date)
      if (!inRange(d, startDate, endDate)) return
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (map[key]) map[key].purchases += p.total
    })

    return months.map((m) => map[m.key])
  }, [transactions, purchases, startDate, endDate])

  return { data, loading }
}

// ─── Category breakdown (expense distribution) ──────────────────────

export function useCategoryBreakdown(): { categories: CategoryCost[]; loading: boolean } {
  const { startDate, endDate } = useDateRange()
  const { data: transactions, loading } = useTransactionsInRange(startDate, endDate)
  const { categories: categoryItems } = useSettings()

  const categories = useMemo<CategoryCost[]>(() => {
    const byCategory: Record<string, number> = {}
    let total = 0

    transactions
      .filter((t) => t.type === 'expense' && inRange(toDate(t.date), startDate, endDate))
      .forEach((t) => {
        const parent = t.category.split(' > ')[0]
        byCategory[parent] = (byCategory[parent] ?? 0) + t.amount
        total += t.amount
      })

    return Object.entries(byCategory)
      .map(([category, amount]) => {
        const group = getCostGroup(category)
        return {
          category,
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          color: categoryItems.find((c) => c.name === category)?.color,
          group,
          groupLabel: COST_GROUP_LABELS[group],
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, categoryItems, startDate, endDate])

  return { categories, loading }
}

// ─── Cost Structure ──────────────────────────────────────────────────

export function useCostStructure(): { kpis: CostStructureKPIs; categories: CategoryCost[]; monthlyCosts: MonthlyCostPoint[]; loading: boolean } {
  const { startDate, endDate } = useDateRange()
  const { prevStart } = useMemo(() => getPreviousPeriod(startDate, endDate), [startDate, endDate])
  const { data: transactions, loading } = useTransactionsInRange(prevStart, endDate)
  const { categories: categoryItems } = useSettings()

  const result = useMemo(() => {
    const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate)
    const inRangeTx = transactions.filter((t) => t.type === 'expense' && inRange(toDate(t.date), startDate, endDate))
    const prevTx = transactions.filter((t) => t.type === 'expense' && inRange(toDate(t.date), prevStart, prevEnd))

    let totalCost = 0, operativeCost = 0, obligationsCost = 0, otherCost = 0
    let prevTotal = 0, prevOperative = 0, prevObligations = 0, prevOther = 0
    const byCategory: Record<string, number> = {}

    inRangeTx.forEach((t) => {
      const parent = t.category.split(' > ')[0]
      totalCost += t.amount
      byCategory[parent] = (byCategory[parent] ?? 0) + t.amount
      const group = getCostGroup(parent)
      if (group === 'operativo') operativeCost += t.amount
      else if (group === 'obligaciones') obligationsCost += t.amount
      else otherCost += t.amount
    })

    prevTx.forEach((t) => {
      const parent = t.category.split(' > ')[0]
      prevTotal += t.amount
      const group = getCostGroup(parent)
      if (group === 'operativo') prevOperative += t.amount
      else if (group === 'obligaciones') prevObligations += t.amount
      else prevOther += t.amount
    })

    const categories: CategoryCost[] = Object.entries(byCategory)
      .map(([category, amount]) => {
        const group = getCostGroup(category)
        return {
          category,
          amount,
          percentage: totalCost > 0 ? (amount / totalCost) * 100 : 0,
          color: categoryItems.find((c) => c.name === category)?.color,
          group,
          groupLabel: COST_GROUP_LABELS[group],
        }
      })
      .sort((a, b) => b.amount - a.amount)

    // Monthly cost evolution
    const months = getMonthsBetween(startDate, endDate)
    const monthlyMap: Record<string, Record<string, number>> = {}
    months.forEach((m) => { monthlyMap[m.key] = {} })

    inRangeTx.forEach((t) => {
      const d = toDate(t.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!monthlyMap[key]) return
      const parent = t.category.split(' > ')[0]
      monthlyMap[key][parent] = (monthlyMap[key][parent] ?? 0) + t.amount
    })

    const monthlyCosts: MonthlyCostPoint[] = months.map((m) => ({
      month: m.label,
      ...monthlyMap[m.key],
    }))

    const kpis: CostStructureKPIs = {
      totalCost,
      operativeCost,
      obligationsCost,
      otherCost,
      operativeRatio: totalCost > 0 ? (operativeCost / totalCost) * 100 : 0,
      obligationsRatio: totalCost > 0 ? (obligationsCost / totalCost) * 100 : 0,
      otherRatio: totalCost > 0 ? (otherCost / totalCost) * 100 : 0,
      totalChange: calcChange(totalCost, prevTotal),
      operativeChange: calcChange(operativeCost, prevOperative),
      obligationsChange: calcChange(obligationsCost, prevObligations),
      otherChange: calcChange(otherCost, prevOther),
    }

    return { kpis, categories, monthlyCosts }
  }, [transactions, categoryItems, startDate, endDate])

  return { ...result, loading }
}

// ─── Purchase Analytics ──────────────────────────────────────────────

export function usePurchaseAnalytics(): {
  kpis: PurchaseAnalyticsKPIs
  suppliers: SupplierData[]
  products: ProductData[]
  monthlyPurchases: MonthlyDataPoint[]
  loading: boolean
} {
  const { startDate, endDate } = useDateRange()
  const { prevStart } = useMemo(() => getPreviousPeriod(startDate, endDate), [startDate, endDate])
  const { data: purchases, loading } = usePurchasesInRange(prevStart, endDate)

  const result = useMemo(() => {
    const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate)
    const inRange_ = purchases.filter((p) => inRange(toDate(p.date), startDate, endDate))
    const prev = purchases.filter((p) => inRange(toDate(p.date), prevStart, prevEnd))

    const totalPurchases = inRange_.reduce((s, p) => s + p.total, 0)
    const prevTotal = prev.reduce((s, p) => s + p.total, 0)
    const orderCount = inRange_.length
    const prevOrders = prev.length
    const avgTicket = orderCount > 0 ? totalPurchases / orderCount : 0
    const prevAvg = prevOrders > 0 ? prevTotal / prevOrders : 0
    const supplierIds = new Set(inRange_.map((p) => p.supplierId))

    const kpis: PurchaseAnalyticsKPIs = {
      totalPurchases,
      orderCount,
      avgTicket,
      activeSuppliers: supplierIds.size,
      totalChange: calcChange(totalPurchases, prevTotal),
      orderChange: calcChange(orderCount, prevOrders),
      ticketChange: calcChange(avgTicket, prevAvg),
      supplierChange: `${supplierIds.size} activos`,
    }

    // Suppliers
    const supplierMap = new Map<string, SupplierData>()
    inRange_.forEach((p) => {
      const existing = supplierMap.get(p.supplierId) ?? { name: p.supplierName, total: 0, count: 0 }
      existing.total += p.total
      existing.count += 1
      supplierMap.set(p.supplierId, existing)
    })
    const suppliers = Array.from(supplierMap.values()).sort((a, b) => b.total - a.total)

    // Products
    const productMap = new Map<string, ProductData>()
    inRange_.forEach((p) => {
      p.items.forEach((item) => {
        const existing = productMap.get(item.productId) ?? { name: item.productName, quantity: 0, total: 0 }
        existing.quantity += item.quantity
        existing.total += item.subtotal
        productMap.set(item.productId, existing)
      })
    })
    const products = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)

    // Monthly
    const months = getMonthsBetween(startDate, endDate)
    const monthMap: Record<string, number> = {}
    months.forEach((m) => { monthMap[m.key] = 0 })
    inRange_.forEach((p) => {
      const d = toDate(p.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (monthMap[key] !== undefined) monthMap[key] += p.total
    })
    const monthlyPurchases: MonthlyDataPoint[] = months.map((m) => ({
      month: m.label,
      income: 0,
      expenses: 0,
      purchases: monthMap[m.key],
    }))

    return { kpis, suppliers, products, monthlyPurchases }
  }, [purchases, startDate, endDate])

  return { ...result, loading }
}

// ─── Payroll Analytics ───────────────────────────────────────────────

export function usePayrollAnalytics(): {
  kpis: PayrollKPIs
  departments: DepartmentPayroll[]
  roles: RolePayroll[]
  loading: boolean
} {
  const { startDate, endDate } = useDateRange()
  const { prevStart } = useMemo(() => getPreviousPeriod(startDate, endDate), [startDate, endDate])
  const { data: employees, loading: empLoading } = useCollection<Employee>('employees')
  const { data: transactions, loading: txLoading } = useTransactionsInRange(prevStart, endDate)

  const loading = empLoading || txLoading

  const result = useMemo(() => {
    const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate)
    const active = employees.filter((e) => e.status === 'active')
    const totalPayroll = active.reduce((s, e) => s + e.salary, 0)

    // Previous period employee count (approximate — use current since we don't track history)
    const prevPayroll = totalPayroll // Salary is monthly, stays same unless changed

    const employeeCount = active.length
    const avgSalary = employeeCount > 0 ? totalPayroll / employeeCount : 0

    // Total income in range for ratio
    const inRangeTx = transactions.filter((t) => t.type === 'income' && inRange(toDate(t.date), startDate, endDate))
    const totalIncome = inRangeTx.reduce((s, t) => s + t.amount, 0)
    const prevIncomeTx = transactions.filter((t) => t.type === 'income' && inRange(toDate(t.date), prevStart, prevEnd))
    const prevIncome = prevIncomeTx.reduce((s, t) => s + t.amount, 0)

    // Estimate monthly payroll * months in range for fair comparison
    const msInRange = endDate.getTime() - startDate.getTime()
    const monthsInRange = Math.max(1, msInRange / (30 * 24 * 60 * 60 * 1000))
    const estimatedPayroll = totalPayroll * monthsInRange
    const prevMonths = Math.max(1, (prevEnd.getTime() - prevStart.getTime()) / (30 * 24 * 60 * 60 * 1000))
    const prevEstimatedPayroll = prevPayroll * prevMonths

    const ratio = totalIncome > 0 ? (estimatedPayroll / totalIncome) * 100 : 0
    const prevRatio = prevIncome > 0 ? (prevEstimatedPayroll / prevIncome) * 100 : 0

    const kpis: PayrollKPIs = {
      totalPayroll: estimatedPayroll,
      employeeCount,
      avgSalary,
      payrollToIncomeRatio: ratio,
      payrollChange: calcChange(estimatedPayroll, prevEstimatedPayroll),
      employeeChange: `${employeeCount} activos`,
      salaryChange: `$${Math.round(avgSalary).toLocaleString('es-CO')} prom.`,
      ratioChange: calcChange(ratio, prevRatio),
    }

    // By department
    const deptMap = new Map<string, DepartmentPayroll>()
    active.forEach((e) => {
      const dept = e.department || 'Sin departamento'
      const existing = deptMap.get(dept) ?? { department: dept, total: 0, count: 0 }
      existing.total += e.salary
      existing.count += 1
      deptMap.set(dept, existing)
    })
    const departments = Array.from(deptMap.values()).sort((a, b) => b.total - a.total)

    // By role
    const roleMap = new Map<string, RolePayroll>()
    active.forEach((e) => {
      const role = e.role || 'Sin cargo'
      const existing = roleMap.get(role) ?? { role, total: 0, count: 0 }
      existing.total += e.salary
      existing.count += 1
      roleMap.set(role, existing)
    })
    const roles = Array.from(roleMap.values()).sort((a, b) => b.total - a.total)

    return { kpis, departments, roles }
  }, [employees, transactions, startDate, endDate])

  return { ...result, loading }
}

// ─── POS Analytics ───────────────────────────────────────────────────

export interface PosCategorySlice {
  category: string
  amount: number
  quantity: number
  productCount: number
}

export interface PosProductSlice {
  id: string
  name: string
  amount: number
  quantity: number
}

export function usePosAnalytics(): {
  totals: PosTotals
  topCategories: PosCategorySlice[]
  categoriesTotal: number
  topProducts: PosProductSlice[]
  allCategories: string[]
  productsByCategory: Record<string, PosProductSlice[]>
  loading: boolean
  rateLimited: boolean
  hasLocales: boolean
  lastUpdated: Date | null
  fromCache: boolean
  forceRefresh: () => void
} {
  const { startDate, endDate } = useDateRange()
  const { localIds, loading: localesLoading } = useCompanyLocalIds()

  const startStr = toDateStrLocal(startDate)
  const endStr = toDateStrLocal(endDate)

  const {
    ventas,
    isPending: ventasPending,
    rateLimited,
    lastUpdated,
    fromCache,
    forceRefresh,
  } = usePosVentas({
    localIds,
    startDate: startStr,
    endDate: endStr,
    enabled: localIds.length > 0,
  })

  // Solo skeleton en primera carga sin data/placeholder. Mismo patrón que
  // Home (`posColdLoading`) y POS Sync (`showSkeleton = loading && !hasData`):
  // durante refetches/auto-refresh, React Query mantiene los datos previos
  // (keepPreviousData) y la UI sigue mostrando KPIs en vez de parpadear al
  // skeleton. Incluimos localesLoading para evitar el flash datos→skeleton→datos.
  const hasData = ventas.length > 0
  const coldLoading = localesLoading || (ventasPending && localIds.length > 0 && !hasData)

  const result = useMemo(() => {
    const valid = ventas.filter((v) => !isAnulada(v))
    const totals = calcTotals(valid)

    const catMap = new Map<string, number>()
    const catQtyMap = new Map<string, number>()
    const catProductIdsMap = new Map<string, Set<string>>()
    const prodMap = new Map<string, PosProductSlice>()
    const perCategoryMap = new Map<string, Map<string, PosProductSlice>>()

    for (const v of valid) {
      const detalle = v.detalle ?? []
      for (const item of detalle) {
        const lineTotal = num(item.venta_total as string | number | undefined)
        const qty = num(item.cantidad_vendida as string | number | undefined)

        const cat = (item.categoria_descripcion ?? 'Sin categoría').trim() || 'Sin categoría'
        catMap.set(cat, (catMap.get(cat) ?? 0) + lineTotal)
        catQtyMap.set(cat, (catQtyMap.get(cat) ?? 0) + qty)
        let catIds = catProductIdsMap.get(cat)
        if (!catIds) {
          catIds = new Set<string>()
          catProductIdsMap.set(cat, catIds)
        }
        catIds.add(String(item.id_producto ?? '?'))

        const pid = String(item.id_producto ?? '?')
        const pname = (item.nombre_producto ?? 'Sin nombre').trim() || 'Sin nombre'
        const existing = prodMap.get(pid)
        if (existing) {
          existing.amount += lineTotal
          existing.quantity += qty
        } else {
          prodMap.set(pid, { id: pid, name: pname, amount: lineTotal, quantity: qty })
        }

        // Agregación por categoría para el filtro local del Top Productos.
        // Un mismo id_producto puede aparecer bajo varias categorías si el POS
        // lo tiene mal catalogado, por eso usamos un Map independiente por
        // categoría en vez de reusar prodMap.
        let catBucket = perCategoryMap.get(cat)
        if (!catBucket) {
          catBucket = new Map<string, PosProductSlice>()
          perCategoryMap.set(cat, catBucket)
        }
        const catExisting = catBucket.get(pid)
        if (catExisting) {
          catExisting.amount += lineTotal
          catExisting.quantity += qty
        } else {
          catBucket.set(pid, { id: pid, name: pname, amount: lineTotal, quantity: qty })
        }
      }
    }

    const sortedCategories = Array.from(catMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        quantity: catQtyMap.get(category) ?? 0,
        productCount: catProductIdsMap.get(category)?.size ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    const categoriesTotal = sortedCategories.reduce((s, c) => s + c.amount, 0)
    const topCategories: PosCategorySlice[] = sortedCategories.slice(0, 5)

    const topProducts: PosProductSlice[] = Array.from(prodMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    const allCategories: string[] = sortedCategories.map((c) => c.category)

    const productsByCategory: Record<string, PosProductSlice[]> = {}
    for (const [cat, bucket] of perCategoryMap) {
      productsByCategory[cat] = Array.from(bucket.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
    }

    return {
      totals,
      topCategories,
      categoriesTotal,
      topProducts,
      allCategories,
      productsByCategory,
    }
  }, [ventas])

  return {
    ...result,
    loading: coldLoading,
    rateLimited,
    hasLocales: localIds.length > 0,
    lastUpdated,
    fromCache,
    forceRefresh,
  }
}
