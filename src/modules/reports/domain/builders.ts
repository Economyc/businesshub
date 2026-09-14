import {
  CHANNEL_GROUPS,
  DELIVERY_CHANNELS,
  DELIVERY_CHANNEL_LABELS,
  type DeliveryChannel,
  type DeliveryOrder,
} from './delivery-orders'
import {
  enumerateDays,
  formatDayShort,
  formatHourBand,
  formatTime12,
  weekBuckets,
  weekdayIndexMondayFirst,
  weekdayShort,
  type ReportPeriod,
} from './period'

// ── Tabla genérica de informe ──
// Una sola forma para la pantalla, el Excel y el CSV: las columnas dicen el tipo
// de dato y las filas traen valores crudos (números sin redondear). El formato
// visible vive en la UI y el redondeo de archivo en export.ts.

export type ColumnType = 'text' | 'channel' | 'integer' | 'currency' | 'percent' | 'variation'

export interface ReportColumn {
  key: string
  /** Encabezado del archivo: completo, porque en Excel cada columna va sola ("Rappi · venta"). */
  header: string
  type: ColumnType
  /** En pantalla: encabezado superior compartido por columnas contiguas ("Rappi"). */
  group?: string
  /** En pantalla: texto corto bajo el grupo o en lugar de `header` ("Venta"). */
  label?: string
  /** Solo `variation`: columna con el valor actual; si hay venta y no hay base, se muestra "Nuevo". */
  currentKey?: string
  /** Sale del periodo anterior: mientras carga no se muestra ($0 y "Nuevo" engañarían). */
  dependsOnPrevious?: boolean
}

export type RowKind = 'group' | 'data' | 'subtotal' | 'total'

export type CellValue = string | number | null

export interface ReportRow {
  kind: RowKind
  channel?: DeliveryChannel
  values: Record<string, CellValue>
}

export interface ReportTableData {
  columns: ReportColumn[]
  rows: ReportRow[]
}

export interface ReportContext {
  orders: DeliveryOrder[]
  previousOrders: DeliveryOrder[]
  period: ReportPeriod
  previousPeriod: ReportPeriod
}

const ratio = (part: number, whole: number): number | null => (whole > 0 ? (part / whole) * 100 : null)
const variation = (current: number, base: number): number | null => (base > 0 ? (current / base - 1) * 100 : null)

interface Tally {
  orders: number
  sales: number
}

function tallyByChannel(orders: DeliveryOrder[]): Record<DeliveryChannel, Tally> {
  const out = Object.fromEntries(DELIVERY_CHANNELS.map((c) => [c, { orders: 0, sales: 0 }])) as Record<
    DeliveryChannel,
    Tally
  >
  for (const o of orders) {
    out[o.channel].orders += 1
    out[o.channel].sales += o.sales
  }
  return out
}

const sumTallies = (tallies: Tally[]): Tally =>
  tallies.reduce((acc, t) => ({ orders: acc.orders + t.orders, sales: acc.sales + t.sales }), { orders: 0, sales: 0 })

/** Par de columnas por canal: grupo "Rappi" con "Pedidos" y "Venta" debajo. */
function channelPairColumns(
  first: { suffix: string; label: string; type: ColumnType },
  second: { suffix: string; label: string; type: ColumnType },
): ReportColumn[] {
  const cols: ReportColumn[] = []
  const channels: { id: string; name: string }[] = [
    ...DELIVERY_CHANNELS.map((c) => ({ id: c, name: DELIVERY_CHANNEL_LABELS[c] })),
    { id: 'total', name: 'Total' },
  ]
  for (const { id, name } of channels) {
    for (const part of [first, second]) {
      cols.push({
        key: `${id}_${part.suffix}`,
        header: `${name} · ${part.label.toLowerCase()}`,
        type: part.type,
        group: name,
        label: part.label,
      })
    }
  }
  return cols
}

// ── Ventas por canal · Resumen ──

export function buildChannelSummary(ctx: ReportContext): ReportTableData {
  const columns: ReportColumn[] = [
    { key: 'canal', header: 'Canal', type: 'channel' },
    { key: 'pedidos', header: 'Pedidos', type: 'integer' },
    { key: 'venta', header: 'Venta neta', type: 'currency' },
    { key: 'ticket', header: 'Ticket promedio', type: 'currency' },
    { key: 'pctPedidos', header: '% pedidos', type: 'percent', group: 'Participación', label: 'Pedidos' },
    { key: 'pctVenta', header: '% venta', type: 'percent', group: 'Participación', label: 'Venta' },
    {
      key: 'ventaAnterior',
      header: 'Venta periodo anterior',
      type: 'currency',
      group: 'Periodo anterior',
      label: 'Venta',
      dependsOnPrevious: true,
    },
    {
      key: 'variacion',
      header: 'Variación %',
      type: 'variation',
      group: 'Periodo anterior',
      label: 'Variación',
      currentKey: 'venta',
      dependsOnPrevious: true,
    },
  ]

  const cur = tallyByChannel(ctx.orders)
  const prev = tallyByChannel(ctx.previousOrders)
  const total = sumTallies(Object.values(cur))
  const totalPrev = sumTallies(Object.values(prev))

  const line = (label: string, t: Tally, p: Tally): Record<string, CellValue> => ({
    canal: label,
    pedidos: t.orders,
    venta: t.sales,
    ticket: t.orders > 0 ? t.sales / t.orders : null,
    pctPedidos: ratio(t.orders, total.orders),
    pctVenta: ratio(t.sales, total.sales),
    ventaAnterior: p.sales,
    variacion: variation(t.sales, p.sales),
  })

  const rows: ReportRow[] = []
  for (const group of CHANNEL_GROUPS) {
    rows.push({ kind: 'group', values: { canal: group.label } })
    for (const channel of group.channels) {
      rows.push({ kind: 'data', channel, values: line(DELIVERY_CHANNEL_LABELS[channel], cur[channel], prev[channel]) })
    }
    rows.push({
      kind: 'subtotal',
      values: line(
        `Subtotal ${group.label.toLowerCase()}`,
        sumTallies(group.channels.map((c) => cur[c])),
        sumTallies(group.channels.map((c) => prev[c])),
      ),
    })
  }
  rows.push({ kind: 'total', values: line('Total domicilios', total, totalPrev) })

  return { columns, rows }
}

// ── Series por canal (semana / día) ──

const seriesColumns = (first: ReportColumn[]): ReportColumn[] => [
  ...first,
  ...channelPairColumns(
    { suffix: 'pedidos', label: 'Pedidos', type: 'integer' },
    { suffix: 'venta', label: 'Venta', type: 'currency' },
  ),
]

function seriesValues(orders: DeliveryOrder[]): Record<string, CellValue> {
  const t = tallyByChannel(orders)
  const values: Record<string, CellValue> = {}
  for (const c of DELIVERY_CHANNELS) {
    values[`${c}_pedidos`] = t[c].orders
    values[`${c}_venta`] = t[c].sales
  }
  const total = sumTallies(Object.values(t))
  values.total_pedidos = total.orders
  values.total_venta = total.sales
  return values
}

export function buildChannelByWeek(ctx: ReportContext): ReportTableData {
  const columns = seriesColumns([{ key: 'semana', header: 'Semana', type: 'text' }])
  const rows: ReportRow[] = weekBuckets(ctx.period).map((w) => ({
    kind: 'data',
    values: {
      semana: w.label,
      ...seriesValues(ctx.orders.filter((o) => o.date >= w.start && o.date <= w.end)),
    },
  }))
  rows.push({ kind: 'total', values: { semana: 'Total', ...seriesValues(ctx.orders) } })
  return { columns, rows }
}

export function buildChannelByDay(ctx: ReportContext): ReportTableData {
  const columns = seriesColumns([
    { key: 'fecha', header: 'Fecha', type: 'text' },
    { key: 'dia', header: 'Día', type: 'text' },
  ])
  const byDate = new Map<string, DeliveryOrder[]>()
  for (const o of ctx.orders) {
    const list = byDate.get(o.date) ?? []
    list.push(o)
    byDate.set(o.date, list)
  }
  const rows: ReportRow[] = enumerateDays(ctx.period).map((date) => ({
    kind: 'data',
    values: { fecha: date, dia: `${weekdayShort(date)} ${formatDayShort(date)}`, ...seriesValues(byDate.get(date) ?? []) },
  }))
  rows.push({ kind: 'total', values: { fecha: 'Total', dia: '', ...seriesValues(ctx.orders) } })
  return { columns, rows }
}

// ── Pedidos por franja horaria ──

function orderCountColumns(first: ReportColumn[]): ReportColumn[] {
  return [
    ...first,
    ...DELIVERY_CHANNELS.map<ReportColumn>((c) => ({
      key: c,
      header: `Pedidos ${DELIVERY_CHANNEL_LABELS[c]}`,
      type: 'integer',
      group: 'Pedidos por canal',
      label: c === 'domicilio' ? 'Domicilio' : DELIVERY_CHANNEL_LABELS[c],
    })),
    { key: 'total', header: 'Total pedidos', type: 'integer', group: 'Total', label: 'Pedidos' },
    { key: 'pct', header: '% del total', type: 'percent', group: 'Total', label: '% del total' },
    { key: 'venta', header: 'Venta neta', type: 'currency', group: 'Total', label: 'Venta neta' },
  ]
}

function orderCountValues(orders: DeliveryOrder[], grandTotal: number): Record<string, CellValue> {
  const t = tallyByChannel(orders)
  const values: Record<string, CellValue> = {}
  for (const c of DELIVERY_CHANNELS) values[c] = t[c].orders
  const total = sumTallies(Object.values(t))
  values.total = total.orders
  values.pct = ratio(total.orders, grandTotal)
  values.venta = total.sales
  return values
}

export function buildOrdersByHour(ctx: ReportContext): ReportTableData {
  const columns = orderCountColumns([{ key: 'hora', header: 'Hora', type: 'text' }])
  const timed = ctx.orders.filter((o) => o.hour !== null)
  const rows: ReportRow[] = []
  if (timed.length > 0) {
    const hours = timed.map((o) => o.hour as number)
    // Solo la franja con pedidos (rellenando huecos): 24 filas con ceros de
    // madrugada esconden lo que importa.
    for (let h = Math.min(...hours); h <= Math.max(...hours); h++) {
      rows.push({
        kind: 'data',
        values: { hora: formatHourBand(h), ...orderCountValues(timed.filter((o) => o.hour === h), ctx.orders.length) },
      })
    }
  }
  rows.push({ kind: 'total', values: { hora: 'Total', ...orderCountValues(timed, ctx.orders.length) } })
  return { columns, rows }
}

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function buildOrdersByWeekday(ctx: ReportContext): ReportTableData {
  const columns = orderCountColumns([{ key: 'dia', header: 'Día de la semana', type: 'text', label: 'Día' }])
  const rows: ReportRow[] = WEEKDAY_NAMES.map((name, i) => ({
    kind: 'data',
    values: {
      dia: name,
      ...orderCountValues(ctx.orders.filter((o) => weekdayIndexMondayFirst(o.date) === i), ctx.orders.length),
    },
  }))
  rows.push({ kind: 'total', values: { dia: 'Total', ...orderCountValues(ctx.orders, ctx.orders.length) } })
  return { columns, rows }
}

// ── Productos por canal ──

interface ProductTally {
  label: string
  category: string
  units: Record<DeliveryChannel, number>
  sales: Record<DeliveryChannel, number>
}

const emptyByChannel = () => Object.fromEntries(DELIVERY_CHANNELS.map((c) => [c, 0])) as Record<DeliveryChannel, number>

const productColumns = (first: ReportColumn[]): ReportColumn[] => [
  ...first,
  ...channelPairColumns(
    { suffix: 'unidades', label: 'Unidades', type: 'integer' },
    { suffix: 'venta', label: 'Venta', type: 'currency' },
  ),
]

function productValues(t: Pick<ProductTally, 'units' | 'sales'>): Record<string, CellValue> {
  const values: Record<string, CellValue> = {}
  let units = 0
  let sales = 0
  for (const c of DELIVERY_CHANNELS) {
    values[`${c}_unidades`] = t.units[c]
    values[`${c}_venta`] = t.sales[c]
    units += t.units[c]
    sales += t.sales[c]
  }
  values.total_unidades = units
  values.total_venta = sales
  return values
}

function tallyItems(orders: DeliveryOrder[], keyOf: (item: DeliveryOrder['items'][number]) => string) {
  const map = new Map<string, ProductTally>()
  const grand = { units: emptyByChannel(), sales: emptyByChannel() }
  for (const o of orders) {
    for (const it of o.items) {
      const key = keyOf(it)
      const t = map.get(key) ?? { label: it.product, category: it.category, units: emptyByChannel(), sales: emptyByChannel() }
      t.units[o.channel] += it.units
      t.sales[o.channel] += it.sales
      map.set(key, t)
      grand.units[o.channel] += it.units
      grand.sales[o.channel] += it.sales
    }
  }
  const total = (t: ProductTally) => DELIVERY_CHANNELS.reduce((s, c) => s + t.units[c], 0)
  const list = [...map.values()].sort((a, b) => total(b) - total(a) || a.label.localeCompare(b.label, 'es'))
  return { list, grand }
}

export function buildProductsByChannel(ctx: ReportContext): ReportTableData {
  const columns = productColumns([
    { key: 'producto', header: 'Producto', type: 'text' },
    { key: 'categoria', header: 'Categoría', type: 'text' },
  ])
  const { list, grand } = tallyItems(ctx.orders, (it) => it.productKey)
  const rows: ReportRow[] = list.map((t) => ({
    kind: 'data',
    values: { producto: t.label, categoria: t.category, ...productValues(t) },
  }))
  rows.push({ kind: 'total', values: { producto: 'Total', categoria: '', ...productValues(grand) } })
  return { columns, rows }
}

export function buildProductsByCategory(ctx: ReportContext): ReportTableData {
  const columns = productColumns([{ key: 'categoria', header: 'Categoría', type: 'text' }])
  const { list, grand } = tallyItems(ctx.orders, (it) => it.category.toLowerCase())
  const rows: ReportRow[] = list.map((t) => ({
    kind: 'data',
    values: { categoria: t.category, ...productValues(t) },
  }))
  rows.push({ kind: 'total', values: { categoria: 'Total', ...productValues(grand) } })
  return { columns, rows }
}

// ── Detalle de pedidos ──

export function buildOrderDetail(ctx: ReportContext): ReportTableData {
  const columns: ReportColumn[] = [
    { key: 'comprobante', header: 'Comprobante', type: 'text' },
    { key: 'fecha', header: 'Fecha', type: 'text' },
    { key: 'hora', header: 'Hora', type: 'text' },
    { key: 'canal', header: 'Canal', type: 'channel' },
    { key: 'pago', header: 'Medio de pago', type: 'text', label: 'Pago' },
    { key: 'cliente', header: 'Cliente', type: 'text' },
    { key: 'subtotal', header: 'Subtotal', type: 'currency' },
    { key: 'descuento', header: 'Descuento', type: 'currency' },
    { key: 'envio', header: 'Envío', type: 'currency' },
    { key: 'total', header: 'Venta neta', type: 'currency' },
  ]
  const rows: ReportRow[] = ctx.orders.map((o) => ({
    kind: 'data',
    channel: o.channel,
    values: {
      comprobante: o.voucher,
      fecha: o.date,
      hora: formatTime12(o.time),
      canal: DELIVERY_CHANNEL_LABELS[o.channel],
      pago: o.payment,
      cliente: o.customer,
      subtotal: o.subtotal,
      descuento: o.discount,
      envio: o.shipping,
      total: o.sales,
    },
  }))
  return { columns, rows }
}
