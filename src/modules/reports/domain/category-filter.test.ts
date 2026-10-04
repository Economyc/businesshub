import { buildTopProducts, type ReportContext } from './builders'
import { applyCategoryFilter, categoryOptions } from './category-filter'
import type { DeliveryOrder } from './delivery-orders'

const item = (product: string, units: number, category: string) => ({
  product,
  productKey: product.toLowerCase(),
  category,
  units,
  sales: units * 10_000,
})
const order = (id: string, items: DeliveryOrder['items']): DeliveryOrder => ({
  id,
  voucher: id,
  date: '2026-09-05',
  time: '19:00',
  hour: 19,
  channel: 'rappi',
  sales: 0,
  subtotal: 0,
  discount: 0,
  shipping: 0,
  payment: '',
  customer: '',
  items,
})

const orders = [
  order('1', [item('Red Smash', 2, 'Hamburguesas'), item('Coca-Cola', 2, 'Bebidas')]),
  order('2', [item('Coca-Cola', 1, 'BEBIDAS')]),
  order('3', [item('Papas', 1, 'Acompañamientos')]),
]
const ctx: ReportContext = {
  orders,
  previousOrders: [order('p', [item('Coca-Cola', 5, 'Bebidas')])],
  period: { start: '2026-09-01', end: '2026-09-30' },
  previousPeriod: { start: '2026-08-01', end: '2026-08-31' },
}
const products = (c: ReportContext) => buildTopProducts(c).rows.filter((r) => r.kind === 'data').map((r) => r.values.producto)

describe('filtro por categoría', () => {
  it('lista las categorías sin distinguir mayúsculas, de más a menos unidades', () => {
    expect(categoryOptions(orders)).toEqual([
      { key: 'bebidas', label: 'Bebidas', units: 3 },
      { key: 'hamburguesas', label: 'Hamburguesas', units: 2 },
      { key: 'acompañamientos', label: 'Acompañamientos', units: 1 },
    ])
  })

  it('sin categorías marcadas no filtra', () => {
    expect(applyCategoryFilter(ctx, { mode: 'include', categories: [] })).toBe(ctx)
  })

  it('excluye bebidas en el periodo actual y en el anterior', () => {
    const f = applyCategoryFilter(ctx, { mode: 'exclude', categories: ['bebidas'] })
    expect(products(f)).toEqual(['Red Smash', 'Papas'])
    expect(f.previousOrders[0].items).toEqual([])
  })

  it('deja solo hamburguesas y el total de pedidos cuenta solo los que las traen', () => {
    const f = applyCategoryFilter(ctx, { mode: 'include', categories: ['hamburguesas'] })
    const { rows } = buildTopProducts(f)
    expect(products(f)).toEqual(['Red Smash'])
    expect(rows[rows.length - 1].values).toMatchObject({ unidades: 2, pedidos: 1 })
  })
})
