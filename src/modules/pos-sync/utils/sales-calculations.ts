import type { PosPago, PosVenta } from '../types'

export function num(val: string | number | undefined | null): number {
  return Number(val) || 0
}

export function isAnulada(v: PosVenta): boolean {
  return v.estado_txt?.toLowerCase() === 'comprobante anulado'
}

// Los nombres de campo de `pagosList` dependen de por dónde llegue el payload:
// la API documentada usa `pagoventa_tipo`/`pagoventa_monto` y el proxy puede
// entregarlos como `tipoPago`/`monto`. Estos dos helpers son el único lugar que
// debería conocer esa ambigüedad.
export function pagoTipo(p: PosPago): string {
  const raw = p as Record<string, unknown>
  return String(raw.pagoventa_tipo ?? raw.tipoPago ?? '').trim()
}

export function pagoMonto(p: PosPago): number {
  const raw = p as Record<string, unknown>
  return num((raw.pagoventa_monto ?? raw.monto) as string | number | undefined)
}

// `tipo_pago` NO es el medio de pago: vale "Contado" en el 100% de los
// comprobantes de las 4 sedes porque es la condición (contado vs. crédito). El
// medio real vive en `pagosList`, y cuando el tipo es tarjeta el dato útil es la
// descripción de la tarjeta (Datafono, Transferencia /Qr, DIDI).
export function getPaymentLabel(v: PosVenta): string {
  const labels = new Set<string>()
  for (const p of v.pagosList ?? []) {
    const tipo = pagoTipo(p)
    if (!tipo) continue
    const detalle = /tarjeta/i.test(tipo) ? (p.tarjeta?.tarjeta_descripcion ?? '').trim() : ''
    labels.add(detalle || tipo)
  }
  if (labels.size === 1) return [...labels][0]
  if (labels.size > 1) return 'Mixto'
  return v.tipo_pago?.trim() || '—'
}

// Algunos POS registran propinas solo en `lista_propinas`, otros las ponen
// en `pagosList` con tipo = "propina" (típicamente cuando se agregan
// después de cerrar la cuenta, o en efectivo). Priorizamos `lista_propinas`;
// si está vacío, caemos al fallback para no perder propinas reales.
export function sumPropinas(v: PosVenta): number {
  const list = v.lista_propinas ?? []
  let s = 0
  for (const p of list) s += num(p.montoConIgv)
  if (s > 0) return s
  for (const p of v.pagosList ?? []) {
    const tipoStr = pagoTipo(p).toLowerCase()
    if (tipoStr.includes('propina') || tipoStr.includes('tip')) s += pagoMonto(p)
  }
  return s
}

export function sumImpuestos(v: PosVenta): number {
  return num(v.impuestos)
}

// Fórmula canónica para "Ventas": total neto del comprobante, sin propinas
// ni costo de envío. Así cuadra 1:1 con el reporte del POS de restaurant.pe
// que también reporta solo el neto. Propinas y envío se muestran aparte en
// el desglose pero no se suman al total principal.
export function ventaMonto(v: PosVenta): number {
  return num(v.total)
}

export function cajaKey(v: PosVenta): string {
  return String(v.caja_id ?? '?')
}

// --- Tipo de comprobante ---

export type DocType = 'factura' | 'boleta' | 'nota' | 'otro'

// El POS marca las facturas con `tipo_documento: "F"`, pero deja el campo VACÍO
// en las notas de venta — de ahí el fallback por `documento`. En las 4 sedes
// solo aparecen esos dos tipos hoy; boleta/otro se mantienen para no romper si
// el POS empieza a emitirlos.
export function getDocType(v: PosVenta): DocType {
  const td = v.tipo_documento?.toUpperCase()
  if (td === 'F') return 'factura'
  if (td === 'B') return 'boleta'
  if (td === 'NV' || v.documento?.toLowerCase().includes('nota')) return 'nota'
  return 'otro'
}

// Plural, para listados y leyendas. Los filtros de la tabla de ventas usan sus
// propias etiquetas en singular ("Factura", "Nota") y no dependen de esto.
export const DOC_TYPE_LABELS: Record<DocType, string> = {
  factura: 'Facturas',
  boleta: 'Boletas',
  nota: 'Notas de venta',
  otro: 'Otros',
}

export interface DocCounts {
  total: number
  factura: number
  boleta: number
  nota: number
  otro: number
}

// Un solo recorrido. `list` debe venir ya filtrada (sin anuladas y solo los
// locales de la company), igual que `calcTotals` — así Análisis e Integraciones
// cuentan exactamente el mismo conjunto.
export function calcDocCounts(list: PosVenta[]): DocCounts {
  const counts: DocCounts = { total: list.length, factura: 0, boleta: 0, nota: 0, otro: 0 }
  for (const v of list) counts[getDocType(v)]++
  return counts
}

// YYYY-MM-DD en zona horaria LOCAL del navegador.
// No usar toISOString() porque en zonas negativas (ej. Perú UTC-5) el
// endOfDay local cae al día siguiente en UTC y desplaza los rangos.
export function toDateStrLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface PosTotals {
  count: number
  ventas: number
  ventasNetas: number
  propinas: number
  envio: number
  impuestos: number
  descuento: number
  ticket: number
}

export function calcTotals(list: PosVenta[]): PosTotals {
  let ventasNetas = 0
  let propinas = 0
  let envio = 0
  let impuestos = 0
  let descuento = 0
  for (const v of list) {
    ventasNetas += num(v.total)
    propinas += sumPropinas(v)
    envio += num(v.costoenvio)
    impuestos += num(v.impuestos)
    descuento += num(v.descuento)
  }
  // `ventas` representa el total principal mostrado en KPIs y debe cuadrar
  // con el reporte del POS: solo neto. Propinas y envío quedan como campos
  // separados para el desglose.
  const ventas = ventasNetas
  return {
    count: list.length,
    ventas,
    ventasNetas,
    propinas,
    envio,
    impuestos,
    descuento,
    ticket: list.length > 0 ? ventas / list.length : 0,
  }
}
