import { useMemo } from 'react'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import {
  calcTotals,
  isAnulada,
  toDateStrLocal,
  num,
  type PosTotals,
} from '@/modules/pos-sync/utils/sales-calculations'

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
