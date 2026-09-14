import {
  buildChannelByDay,
  buildChannelByWeek,
  buildChannelSummary,
  buildOrderDetail,
  buildOrdersByHour,
  buildOrdersByWeekday,
  buildProductsByCategory,
  buildProductsByChannel,
  type ReportContext,
  type ReportRow,
} from './builders'
import type { DeliveryChannel, DeliveryOrder } from './delivery-orders'
import { toFieldDefs, toFileRows, companyFileLabel, reportFileName } from './export'

let seq = 0
function order(channel: DeliveryChannel, sales: number, date = '2026-08-07', time = '19:30', items: DeliveryOrder['items'] = []): DeliveryOrder {
  seq += 1
  return {
    id: String(seq),
    voucher: `FVBT-${seq}`,
    date,
    time,
    hour: time ? Number(time.slice(0, 2)) : null,
    channel,
    sales,
    subtotal: sales,
    discount: 0,
    shipping: 0,
    payment: 'En linea',
    customer: '',
    items,
  }
}

const period = { start: '2026-08-01', end: '2026-08-31' }
const previousPeriod = { start: '2026-07-01', end: '2026-07-31' }
const ctx = (orders: DeliveryOrder[], previousOrders: DeliveryOrder[] = []): ReportContext => ({
  orders,
  previousOrders,
  period,
  previousPeriod,
})

const byLabel = (rows: ReportRow[], key: string, label: string) => rows.find((r) => r.values[key] === label)!

describe('buildChannelSummary', () => {
  const current = [
    order('rappi', 100_000),
    order('rappi', 60_000),
    order('didi', 40_000),
    order('web', 80_000),
    order('domicilio', 120_000),
  ]
  const previous = [order('rappi', 200_000), order('domicilio', 100_000)]
  const { rows } = buildChannelSummary(ctx(current, previous))

  it('agrupa plataformas y propios con subtotales y total', () => {
    expect(rows.map((r) => r.kind)).toEqual(['group', 'data', 'data', 'subtotal', 'group', 'data', 'data', 'subtotal', 'total'])
    expect(byLabel(rows, 'canal', 'Subtotal plataformas').values).toMatchObject({ pedidos: 3, venta: 200_000 })
    expect(byLabel(rows, 'canal', 'Subtotal propios').values).toMatchObject({ pedidos: 2, venta: 200_000 })
    expect(byLabel(rows, 'canal', 'Total domicilios').values).toMatchObject({ pedidos: 5, venta: 400_000, pctVenta: 100 })
  })

  it('calcula participación, ticket y variación', () => {
    const rappi = byLabel(rows, 'canal', 'Rappi').values
    expect(rappi.pctPedidos).toBeCloseTo(40)
    expect(rappi.pctVenta).toBeCloseTo(40)
    expect(rappi.ticket).toBe(80_000)
    expect(rappi.variacion).toBeCloseTo(-20)
    expect(byLabel(rows, 'canal', 'Domicilio telefónico').values.variacion).toBeCloseTo(20)
  })

  it('sin base anterior la variación queda vacía (se muestra Nuevo)', () => {
    expect(byLabel(rows, 'canal', 'DiDi').values.variacion).toBeNull()
    expect(byLabel(rows, 'canal', 'Web').values.ventaAnterior).toBe(0)
  })

  it('muestra los 4 canales aunque no tengan ventas', () => {
    const empty = buildChannelSummary(ctx([order('rappi', 10_000)]))
    const didi = byLabel(empty.rows, 'canal', 'DiDi').values
    expect(didi).toMatchObject({ pedidos: 0, venta: 0, ticket: null })
  })
})

describe('series por canal', () => {
  const orders = [order('rappi', 10_000, '2026-08-01'), order('web', 20_000, '2026-08-08'), order('web', 5_000, '2026-08-31')]

  it('reparte por semanas de 7 días y cuadra el total', () => {
    const { rows } = buildChannelByWeek(ctx(orders))
    expect(rows).toHaveLength(6) // 5 semanas + total
    expect(rows[0].values).toMatchObject({ semana: '1 al 7 ago', rappi_pedidos: 1, total_venta: 10_000 })
    expect(rows[1].values).toMatchObject({ web_pedidos: 1, web_venta: 20_000 })
    expect(rows[4].values).toMatchObject({ semana: '29 al 31 ago', web_venta: 5_000 })
    expect(rows[5].values).toMatchObject({ total_pedidos: 3, total_venta: 35_000 })
  })

  it('lista todos los días del periodo, con ceros', () => {
    const { rows } = buildChannelByDay(ctx(orders))
    expect(rows).toHaveLength(32)
    expect(rows[1].values).toMatchObject({ fecha: '2026-08-02', total_pedidos: 0 })
  })
})

describe('franjas', () => {
  const orders = [order('rappi', 1, '2026-08-07', '12:10'), order('didi', 1, '2026-08-07', '14:59'), order('rappi', 1, '2026-08-08', '14:00')]

  it('cubre solo las horas con pedidos rellenando huecos', () => {
    const { rows } = buildOrdersByHour(ctx(orders))
    expect(rows.map((r) => r.values.hora)).toEqual(['12:00 – 12:59 p. m.', '1:00 – 1:59 p. m.', '2:00 – 2:59 p. m.', 'Total'])
    expect(rows[2].values).toMatchObject({ rappi: 1, didi: 1, total: 2 })
    expect(rows[2].values.pct).toBeCloseTo(66.67, 1)
  })

  it('ordena lunes a domingo', () => {
    const { rows } = buildOrdersByWeekday(ctx(orders))
    expect(rows[4].values).toMatchObject({ dia: 'Viernes', total: 2 }) // 7 ago 2026
    expect(rows[5].values).toMatchObject({ dia: 'Sábado', total: 1 })
    expect(rows[7].values).toMatchObject({ dia: 'Total', total: 3 })
  })
})

describe('productos', () => {
  const item = (product: string, units: number, sales: number, category = 'Hamburguesas') => ({
    product,
    productKey: product.toLowerCase(),
    category,
    units,
    sales,
  })
  const orders = [
    order('rappi', 0, '2026-08-07', '19:00', [item('Red Smash', 2, 64_000), item('Papas', 1, 9_000, 'Acompañamientos')]),
    order('web', 0, '2026-08-07', '19:00', [item('RED SMASH', 1, 32_000)]),
  ]

  it('suma unidades y venta por canal y ordena por unidades', () => {
    const { rows } = buildProductsByChannel(ctx(orders))
    expect(rows[0].values).toMatchObject({ producto: 'Red Smash', rappi_unidades: 2, web_unidades: 1, total_unidades: 3, total_venta: 96_000 })
    expect(rows[rows.length - 1].values).toMatchObject({ producto: 'Total', total_unidades: 4, total_venta: 105_000 })
  })

  it('agrupa por categoría', () => {
    const { rows } = buildProductsByCategory(ctx(orders))
    expect(rows.map((r) => r.values.categoria)).toEqual(['Hamburguesas', 'Acompañamientos', 'Total'])
  })
})

describe('exportación', () => {
  it('redondea para archivo y deja en blanco lo que no aplica', () => {
    const table = buildChannelSummary(ctx([order('rappi', 100_000.4), order('didi', 33_333.3)]))
    const rows = toFileRows(table)
    const rappi = rows.find((r) => r.canal === 'Rappi')!
    expect(rappi.venta).toBe(100_000)
    expect(rappi.pctVenta).toBe(75)
    expect(rows[0]).toMatchObject({ canal: 'Plataformas', pedidos: null })
    expect(toFieldDefs(table).find((f) => f.key === 'variacion')).toMatchObject({ type: 'number', blankNull: true })
  })

  it('arma el detalle con una fila por pedido', () => {
    const { rows } = buildOrderDetail(ctx([order('web', 50_000)]))
    expect(rows[0]).toMatchObject({ channel: 'web', values: { canal: 'Web', hora: '7:30 p. m.', total: 50_000 } })
  })

  it('nombra el archivo con la sede y el periodo', () => {
    const label = companyFileLabel({ name: 'Blue Smash Brgr', location: 'Escondite' })
    expect(label).toBe('Blue-Escondite')
    expect(reportFileName(label, 'ventas-por-canal', period)).toBe('Blue-Escondite_ventas-por-canal_2026-08')
    expect(reportFileName(label, 'ventas-por-canal', period, 'resumen')).toBe('Blue-Escondite_ventas-por-canal_resumen_2026-08')
  })
})
