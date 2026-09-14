import type { PosVenta } from '@/modules/pos-sync/types'
import { getSalesChannel } from '@/modules/pos-sync/utils/sales-channel'
import { getPaymentLabel, isAnulada, num, ventaMonto } from '@/modules/pos-sync/utils/sales-calculations'

export type DeliveryChannel = 'rappi' | 'didi' | 'web' | 'domicilio'

export const DELIVERY_CHANNELS: DeliveryChannel[] = ['rappi', 'didi', 'web', 'domicilio']

export const DELIVERY_CHANNEL_LABELS: Record<DeliveryChannel, string> = {
  rappi: 'Rappi',
  didi: 'DiDi',
  web: 'Web',
  domicilio: 'Domicilio telefónico',
}

export interface ChannelGroup {
  id: 'plataformas' | 'propios'
  label: string
  channels: DeliveryChannel[]
}

export const CHANNEL_GROUPS: ChannelGroup[] = [
  { id: 'plataformas', label: 'Plataformas', channels: ['rappi', 'didi'] },
  { id: 'propios', label: 'Propios', channels: ['web', 'domicilio'] },
]

export interface DeliveryOrderItem {
  /** Nombre legible, sin el sufijo " -" que agrega el POS. */
  product: string
  /** Clave de agrupación: sin tildes, minúsculas, espacios simples. */
  productKey: string
  category: string
  units: number
  sales: number
}

export interface DeliveryOrder {
  id: string
  voucher: string
  date: string
  /** "HH:mm", vacío si el POS no mandó hora. */
  time: string
  hour: number | null
  channel: DeliveryChannel
  /** Venta neta: sin propina ni envío (misma fórmula que POS Sync). */
  sales: number
  subtotal: number
  discount: number
  shipping: number
  payment: string
  customer: string
  items: DeliveryOrderItem[]
}

const DELIVERY_SET = new Set<string>(DELIVERY_CHANNELS)

export function cleanProductName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s\-–—.,;:]+$/, '')
    .trim()
}

export function productKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// El caché trae el nombre completo en `cliente.cliente`; `cliente_nombres` y
// `cliente_apellidos` son la forma documentada de la API y quedan de respaldo.
function customerName(v: PosVenta): string {
  const c = v.cliente
  if (!c) return ''
  const full = String(c.cliente ?? '').trim()
  if (full) return full
  return [c.cliente_nombres, c.cliente_apellidos]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Pedidos a domicilio de la sede. Filtra por `id_local` con Number(): el caché
 * de Manila y Escondite (mismo tenant 'blue') trae comprobantes de la otra sede,
 * y el POS no siempre manda el id como número. Excluye anulados, salón y canales
 * desconocidos. Deduplica por comprobante por si dos páginas del caché se solapan.
 */
export function toDeliveryOrders(ventas: PosVenta[], localIds: number[]): DeliveryOrder[] {
  const locals = new Set(localIds.map(Number))
  const seen = new Set<string>()
  const orders: DeliveryOrder[] = []

  for (const v of ventas) {
    if (!locals.has(Number(v.id_local))) continue
    if (isAnulada(v)) continue
    const channel = getSalesChannel(v)
    if (!DELIVERY_SET.has(channel)) continue

    const voucher = [v.serie, v.correlativo].filter(Boolean).join('-')
    const key = `${Number(v.id_local)}:${v.ID ?? voucher}`
    if (seen.has(key)) continue
    seen.add(key)

    const fecha = String(v.fecha ?? '')
    const time = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(fecha) ? fecha.slice(11, 16) : ''

    orders.push({
      id: key,
      voucher: voucher || String(v.ID ?? ''),
      date: fecha.slice(0, 10),
      time,
      hour: time ? Number(time.slice(0, 2)) : null,
      channel: channel as DeliveryChannel,
      sales: ventaMonto(v),
      subtotal: num(v.subtotal),
      discount: num(v.descuento),
      shipping: num(v.costoenvio),
      payment: getPaymentLabel(v),
      customer: customerName(v),
      items: (v.detalle ?? []).map((it) => {
        const product = cleanProductName(it.nombre_producto) || 'Sin nombre'
        return {
          product,
          productKey: productKey(product),
          category: String(it.categoria_descripcion ?? '').trim() || 'Sin categoría',
          units: num(it.cantidad_vendida),
          sales: num(it.venta_total),
        }
      }),
    })
  }

  return orders.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}
