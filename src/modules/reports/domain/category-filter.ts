import type { ReportContext } from './builders'
import type { DeliveryOrder } from './delivery-orders'

/** `include`: solo las categorías marcadas. `exclude`: todas menos las marcadas. */
export type CategoryFilterMode = 'include' | 'exclude'

export interface CategoryFilter {
  mode: CategoryFilterMode
  /** Claves en minúscula, igual que agrupa Top categorías. */
  categories: string[]
}

export const EMPTY_CATEGORY_FILTER: CategoryFilter = { mode: 'exclude', categories: [] }

export const categoryKey = (category: string) => category.toLowerCase()

export interface CategoryOption {
  key: string
  label: string
  units: number
}

/** Categorías con venta en el periodo, de más a menos unidades. */
export function categoryOptions(orders: DeliveryOrder[]): CategoryOption[] {
  const map = new Map<string, CategoryOption>()
  for (const o of orders) {
    for (const it of o.items) {
      const key = categoryKey(it.category)
      const opt = map.get(key) ?? { key, label: it.category, units: 0 }
      opt.units += it.units
      map.set(key, opt)
    }
  }
  return [...map.values()].sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, 'es'))
}

/**
 * Deja en cada pedido solo los ítems que pasan el filtro. Los pedidos se
 * conservan (con lista vacía si nada pasa) para que el total de pedidos siga
 * contando solo los que traen algo del filtro.
 */
export function applyCategoryFilter(ctx: ReportContext, filter: CategoryFilter): ReportContext {
  if (filter.categories.length === 0) return ctx
  const set = new Set(filter.categories)
  const keep = (category: string) => set.has(categoryKey(category)) === (filter.mode === 'include')
  const filterOrders = (orders: DeliveryOrder[]) =>
    orders.map((o) => ({ ...o, items: o.items.filter((it) => keep(it.category)) }))
  return { ...ctx, orders: filterOrders(ctx.orders), previousOrders: filterOrders(ctx.previousOrders) }
}
