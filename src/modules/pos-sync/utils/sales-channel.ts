import type { CSSProperties } from 'react'
import type { PosVenta } from '../types'
import { isAnulada, pagoTipo, ventaMonto } from './sales-calculations'

// El POS entrega el canal en tres campos que hay que leer juntos:
//   canalventa            "SALONES" | "DELIVERY"  (siempre viene lleno)
//   id_canaldelivery      id del catálogo de canales; vacío en salón
//   nombre_canaldelivery  nombre del canal; vacío en salón
// Un `canalventa || nombre_canaldelivery` nunca alcanza el segundo, y por eso
// hasta ahora toda plataforma que no fuera Rappi se veía como "DELIVERY".
export type SalesChannel = 'salon' | 'domicilio' | 'web' | 'rappi' | 'didi' | 'otro'

// Ids del catálogo de canales de delivery del POS (restaurant.pe). Verificados
// idénticos en los dos dominios que usamos —blue (8267) y filipo (9405)— sobre
// las ventas de 2026 de las 4 sedes.
const CHANNEL_BY_ID: Record<string, SalesChannel> = {
  '505': 'didi', // "Didi Food"
  '512': 'domicilio', // "Delivery Telefónico": domicilio propio (teléfono, WhatsApp y web)
  '516': 'rappi', // "Rappi"
}

// Respaldo por nombre, por si el POS estrena un id para la misma plataforma.
const RAPPI_RE = /rappi/i
const DIDI_RE = /didi/i

// Medio de pago con el que liquida la web de pedidos propia.
const ONLINE_PAYMENT_RE = /^en\s*l[ií]nea$/i

function hasOnlinePayment(v: PosVenta): boolean {
  return (v.pagosList ?? []).some((p) => ONLINE_PAYMENT_RE.test(pagoTipo(p)))
}

// HEURÍSTICA: el POS no marca el origen web. Los pedidos de la web propia caen
// en "Delivery Telefónico" junto al teléfono y WhatsApp, y sólo se distinguen
// por el medio de pago: "En linea" aparece por primera vez en agosto de 2026
// —cero en abril-julio— exactamente cuando arrancó la web (66 pedidos,
// $5.760.050 en Blue Escondite). Un pedido web pagado contraentrega queda como
// `domicilio`: es el límite conocido y aceptado de esta inferencia.
export function getSalesChannel(v: PosVenta): SalesChannel {
  const nombre = String(v.nombre_canaldelivery ?? '')
  let channel = CHANNEL_BY_ID[String(v.id_canaldelivery ?? '').trim()]

  if (!channel) {
    if (RAPPI_RE.test(nombre)) channel = 'rappi'
    else if (DIDI_RE.test(nombre)) channel = 'didi'
  }

  if (!channel) {
    const canal = String(v.canalventa ?? '').trim().toUpperCase()
    if (canal === 'DELIVERY' || nombre.trim()) channel = 'domicilio'
    else if (canal === 'SALONES') channel = 'salon'
    else return 'otro'
  }

  if (channel === 'domicilio' && hasOnlinePayment(v)) return 'web'
  return channel
}

// Mayúsculas: son pills de tabla, cortas y comparables de un vistazo.
const PILL_LABELS: Record<Exclude<SalesChannel, 'otro'>, string> = {
  salon: 'SALÓN',
  domicilio: 'DOMICILIO',
  web: 'WEB',
  rappi: 'RAPPI',
  didi: 'DIDI',
}

// Capitalizadas: filtros y tarjetas, donde conviven con "Todos"/"Caja 1".
const FILTER_LABELS: Record<Exclude<SalesChannel, 'otro'>, string> = {
  salon: 'Salón',
  domicilio: 'Domicilio',
  web: 'Web',
  rappi: 'Rappi',
  didi: 'DiDi',
}

// Para 'otro' devolvemos el texto crudo del POS: una plataforma nueva se ve
// aunque no la conozcamos, en vez de desaparecer dentro de una etiqueta genérica.
function rawChannelText(v: PosVenta): string {
  const raw = String(v.nombre_canaldelivery || v.canalventa || '').trim()
  return raw || '—'
}

export function getChannelLabel(v: PosVenta): string {
  const channel = getSalesChannel(v)
  return channel === 'otro' ? rawChannelText(v) : PILL_LABELS[channel]
}

export function channelFilterLabel(channel: SalesChannel): string {
  return channel === 'otro' ? 'Otro' : FILTER_LABELS[channel]
}

// DESIGN_SYSTEM.md §3 prohíbe hex suelto en JSX. Rappi, DiDi y la web propia
// son colores de marca sin token equivalente, así que se centralizan acá —mismo
// criterio que core/ui/chart-colors.ts para gráficos— en lugar de quedar
// repartidos por el TSX.
const BRAND_COLOR: Partial<Record<SalesChannel, string>> = {
  web: '#1053D5',
  rappi: '#FF4219',
  didi: '#FF7D41',
}

const TOKEN_CLASSES: Partial<Record<SalesChannel, string>> = {
  salon: 'bg-bone text-graphite',
  domicilio: 'bg-info-bg text-info-text',
  otro: 'bg-bone text-graphite',
}

export interface ChannelStyle {
  className: string
  style?: CSSProperties
}

export function getChannelStyle(channel: SalesChannel): ChannelStyle {
  const brand = BRAND_COLOR[channel]
  if (brand) return { className: 'text-white font-medium', style: { backgroundColor: brand } }
  return { className: TOKEN_CLASSES[channel] ?? 'bg-bone text-graphite' }
}

export interface ChannelSlice {
  channel: SalesChannel
  label: string
  count: number
  monto: number
  pct: number
}

export function calcChannelBreakdown(list: PosVenta[]): ChannelSlice[] {
  const groups = new Map<SalesChannel, { count: number; monto: number }>()
  let total = 0
  for (const v of list) {
    if (isAnulada(v)) continue
    const channel = getSalesChannel(v)
    const monto = ventaMonto(v)
    const cur = groups.get(channel) ?? { count: 0, monto: 0 }
    cur.count += 1
    cur.monto += monto
    groups.set(channel, cur)
    total += monto
  }
  return Array.from(groups.entries())
    .map(([channel, { count, monto }]) => ({
      channel,
      label: channelFilterLabel(channel),
      count,
      monto,
      pct: total > 0 ? (monto / total) * 100 : 0,
    }))
    .sort((a, b) => b.monto - a.monto)
}
