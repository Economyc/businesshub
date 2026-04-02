import { useMemo } from 'react'
import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy } from 'firebase/firestore'
import type { Product, Purchase } from './types'

// --- Basic hooks ---

export function useProducts() {
  return useCollection<Product>('products')
}

export function useProduct(id: string | undefined) {
  return useDocument<Product>('products', id)
}

export function usePurchases() {
  return useCollection<Purchase>('purchases')
}

export function usePurchase(id: string | undefined) {
  return useDocument<Purchase>('purchases', id)
}

export function usePaginatedPurchases() {
  return usePaginatedCollection<Purchase>('purchases', 50, orderBy('createdAt', 'desc'))
}

// --- Calculation hooks ---

export interface PurchaseSummaryData {
  totalMonth: number
  totalPrevMonth: number
  changePercent: number
  purchaseCount: number
  topSupplier: { name: string; total: number } | null
  topProduct: { name: string; total: number } | null
  bySupplier: { name: string; total: number; count: number }[]
  byCategory: { category: string; total: number }[]
  topProducts: { name: string; total: number; quantity: number; unit: string }[]
}

export function usePurchaseSummary(month: number, year: number) {
  const { data: purchases, loading } = usePurchases()

  const summary = useMemo<PurchaseSummaryData>(() => {
    const periodStart = new Date(year, month, 1)
    const periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)
    const prevStart = new Date(year, month - 1, 1)
    const prevEnd = new Date(year, month, 0, 23, 59, 59, 999)

    const inRange = (p: Purchase, start: Date, end: Date) => {
      const d = p.date?.toDate?.()
      return d && d >= start && d <= end
    }

    const monthPurchases = purchases.filter((p) => inRange(p, periodStart, periodEnd))
    const prevPurchases = purchases.filter((p) => inRange(p, prevStart, prevEnd))

    const totalMonth = monthPurchases.reduce((s, p) => s + p.total, 0)
    const totalPrevMonth = prevPurchases.reduce((s, p) => s + p.total, 0)
    const changePercent = totalPrevMonth > 0
      ? ((totalMonth - totalPrevMonth) / totalPrevMonth) * 100
      : totalMonth > 0 ? 100 : 0

    // By supplier
    const supplierMap = new Map<string, { name: string; total: number; count: number }>()
    for (const p of monthPurchases) {
      const existing = supplierMap.get(p.supplierId) ?? { name: p.supplierName, total: 0, count: 0 }
      existing.total += p.total
      existing.count += 1
      supplierMap.set(p.supplierId, existing)
    }
    const bySupplier = Array.from(supplierMap.values()).sort((a, b) => b.total - a.total)

    // By product
    const productMap = new Map<string, { name: string; total: number; quantity: number; unit: string }>()
    const categoryMap = new Map<string, number>()

    for (const p of monthPurchases) {
      for (const item of p.items) {
        const existing = productMap.get(item.productId) ?? { name: item.productName, total: 0, quantity: 0, unit: item.unit }
        existing.total += item.subtotal
        existing.quantity += item.quantity
        productMap.set(item.productId, existing)
      }
    }

    // By category — we need product data to get categories, but items don't have category
    // We'll use a simple approach: group by product name prefix or just skip category for now
    // Actually, we can derive from the purchases items indirectly — but we need product catalog
    // For simplicity, we'll leave byCategory empty and populate it in dashboard using products data

    const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)

    return {
      totalMonth,
      totalPrevMonth,
      changePercent,
      purchaseCount: monthPurchases.length,
      topSupplier: bySupplier[0] ?? null,
      topProduct: topProducts[0] ? { name: topProducts[0].name, total: topProducts[0].total } : null,
      bySupplier,
      byCategory: Array.from(categoryMap.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
      topProducts,
    }
  }, [purchases, month, year])

  return { summary, loading }
}

export interface PurchaseTrendPoint {
  month: string
  total: number
  count: number
}

export function usePurchaseTrends(months: number = 12) {
  const { data: purchases, loading } = usePurchases()

  const trends = useMemo<PurchaseTrendPoint[]>(() => {
    const now = new Date()
    const points: PurchaseTrendPoint[] = []
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)

      const monthPurchases = purchases.filter((p) => {
        const pd = p.date?.toDate?.()
        return pd && pd >= start && pd <= end
      })

      points.push({
        month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        total: monthPurchases.reduce((s, p) => s + p.total, 0),
        count: monthPurchases.length,
      })
    }

    return points
  }, [purchases, months])

  return { trends, loading }
}

export interface PriceHistoryPoint {
  date: string
  price: number
  supplierName: string
}

export interface ProductPriceData {
  history: PriceHistoryPoint[]
  avgPrice: number
  minPrice: number
  maxPrice: number
  lastPrice: number
  supplierComparison: { supplierName: string; avgPrice: number; lastPrice: number; count: number }[]
  consumptionByMonth: { month: string; quantity: number }[]
}

export function useProductPriceHistory(productId: string | undefined) {
  const { data: purchases, loading } = usePurchases()

  const priceData = useMemo<ProductPriceData>(() => {
    if (!productId) return { history: [], avgPrice: 0, minPrice: 0, maxPrice: 0, lastPrice: 0, supplierComparison: [], consumptionByMonth: [] }

    const history: PriceHistoryPoint[] = []
    const supplierPrices = new Map<string, { prices: number[]; lastPrice: number }>()
    const monthlyQty = new Map<string, number>()
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (const p of purchases) {
      for (const item of p.items) {
        if (item.productId !== productId) continue
        const d = p.date?.toDate?.()
        if (!d) continue

        history.push({
          date: d.toLocaleDateString('es-CO'),
          price: item.unitPrice,
          supplierName: p.supplierName,
        })

        const sp = supplierPrices.get(p.supplierName) ?? { prices: [], lastPrice: 0 }
        sp.prices.push(item.unitPrice)
        sp.lastPrice = item.unitPrice
        supplierPrices.set(p.supplierName, sp)

        const monthKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
        monthlyQty.set(monthKey, (monthlyQty.get(monthKey) ?? 0) + item.quantity)
      }
    }

    history.sort((a, b) => {
      const da = new Date(a.date.split('/').reverse().join('-'))
      const db = new Date(b.date.split('/').reverse().join('-'))
      return da.getTime() - db.getTime()
    })

    const prices = history.map((h) => h.price)
    const avg = prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0

    const supplierComparison = Array.from(supplierPrices.entries()).map(([supplierName, data]) => ({
      supplierName,
      avgPrice: data.prices.reduce((s, p) => s + p, 0) / data.prices.length,
      lastPrice: data.lastPrice,
      count: data.prices.length,
    })).sort((a, b) => a.avgPrice - b.avgPrice)

    const consumptionByMonth = Array.from(monthlyQty.entries()).map(([month, quantity]) => ({ month, quantity }))

    return {
      history,
      avgPrice: Math.round(avg),
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      lastPrice: prices.length > 0 ? prices[prices.length - 1] : 0,
      supplierComparison,
      consumptionByMonth,
    }
  }, [purchases, productId])

  return { priceData, loading }
}

export interface SupplierPurchaseData {
  purchases: Purchase[]
  totalSpent: number
  purchaseCount: number
  monthlyTrend: { month: string; total: number }[]
  productBreakdown: { productName: string; totalQty: number; totalSpent: number; avgPrice: number }[]
}

export function useSupplierPurchases(supplierId: string | undefined) {
  const { data: purchases, loading } = usePurchases()

  const supplierData = useMemo<SupplierPurchaseData>(() => {
    if (!supplierId) return { purchases: [], totalSpent: 0, purchaseCount: 0, monthlyTrend: [], productBreakdown: [] }

    const filtered = purchases.filter((p) => p.supplierId === supplierId)
    const totalSpent = filtered.reduce((s, p) => s + p.total, 0)

    const monthMap = new Map<string, number>()
    const productMap = new Map<string, { totalQty: number; totalSpent: number; prices: number[] }>()
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (const p of filtered) {
      const d = p.date?.toDate?.()
      if (d) {
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
        monthMap.set(key, (monthMap.get(key) ?? 0) + p.total)
      }

      for (const item of p.items) {
        const existing = productMap.get(item.productName) ?? { totalQty: 0, totalSpent: 0, prices: [] }
        existing.totalQty += item.quantity
        existing.totalSpent += item.subtotal
        existing.prices.push(item.unitPrice)
        productMap.set(item.productName, existing)
      }
    }

    const monthlyTrend = Array.from(monthMap.entries()).map(([month, total]) => ({ month, total }))
    const productBreakdown = Array.from(productMap.entries())
      .map(([productName, data]) => ({
        productName,
        totalQty: data.totalQty,
        totalSpent: data.totalSpent,
        avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)

    return { purchases: filtered, totalSpent, purchaseCount: filtered.length, monthlyTrend, productBreakdown }
  }, [purchases, supplierId])

  return { supplierData, loading }
}

export interface PurchaseAlert {
  type: 'price_increase' | 'price_decrease' | 'consumption_spike' | 'consumption_drop'
  productName: string
  message: string
  value: number
  severity: 'warning' | 'info'
}

export function usePurchaseAlerts() {
  const { data: purchases, loading } = usePurchases()

  const alerts = useMemo<PurchaseAlert[]>(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    const sixtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)

    const recentPurchases = purchases.filter((p) => {
      const d = p.date?.toDate?.()
      return d && d >= thirtyDaysAgo
    })
    const prevPurchases = purchases.filter((p) => {
      const d = p.date?.toDate?.()
      return d && d >= sixtyDaysAgo && d < thirtyDaysAgo
    })

    // Aggregate by product
    const recentProducts = new Map<string, { name: string; prices: number[]; quantity: number }>()
    const prevProducts = new Map<string, { prices: number[]; quantity: number }>()

    for (const p of recentPurchases) {
      for (const item of p.items) {
        const existing = recentProducts.get(item.productId) ?? { name: item.productName, prices: [], quantity: 0 }
        existing.prices.push(item.unitPrice)
        existing.quantity += item.quantity
        recentProducts.set(item.productId, existing)
      }
    }

    for (const p of prevPurchases) {
      for (const item of p.items) {
        const existing = prevProducts.get(item.productId) ?? { prices: [], quantity: 0 }
        existing.prices.push(item.unitPrice)
        existing.quantity += item.quantity
        prevProducts.set(item.productId, existing)
      }
    }

    const result: PurchaseAlert[] = []

    for (const [productId, recent] of recentProducts) {
      const prev = prevProducts.get(productId)
      if (!prev) continue

      const avgRecent = recent.prices.reduce((s, p) => s + p, 0) / recent.prices.length
      const avgPrev = prev.prices.reduce((s, p) => s + p, 0) / prev.prices.length

      if (avgPrev > 0) {
        const priceChange = ((avgRecent - avgPrev) / avgPrev) * 100
        if (priceChange > 5) {
          result.push({
            type: 'price_increase',
            productName: recent.name,
            message: `Precio subió ${priceChange.toFixed(1)}% en últimos 30 días`,
            value: priceChange,
            severity: 'warning',
          })
        } else if (priceChange < -5) {
          result.push({
            type: 'price_decrease',
            productName: recent.name,
            message: `Precio bajó ${Math.abs(priceChange).toFixed(1)}% en últimos 30 días`,
            value: priceChange,
            severity: 'info',
          })
        }
      }

      if (prev.quantity > 0) {
        const qtyChange = ((recent.quantity - prev.quantity) / prev.quantity) * 100
        if (qtyChange > 30) {
          result.push({
            type: 'consumption_spike',
            productName: recent.name,
            message: `Consumo aumentó ${qtyChange.toFixed(1)}% vs periodo anterior`,
            value: qtyChange,
            severity: 'warning',
          })
        } else if (qtyChange < -30) {
          result.push({
            type: 'consumption_drop',
            productName: recent.name,
            message: `Consumo disminuyó ${Math.abs(qtyChange).toFixed(1)}% vs periodo anterior`,
            value: qtyChange,
            severity: 'info',
          })
        }
      }
    }

    return result.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  }, [purchases])

  return { alerts, loading }
}
