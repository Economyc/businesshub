import type { PosVenta } from '../types'

export function num(val: string | number | undefined | null): number {
  return Number(val) || 0
}

export function isAnulada(v: PosVenta): boolean {
  return v.estado_txt?.toLowerCase() === 'comprobante anulado'
}

// Algunos POS registran propinas solo en `lista_propinas`, otros las ponen
// en `pagosList` con tipo = "propina" (típicamente cuando se agregan
// después de cerrar la cuenta, o en efectivo). Priorizamos `lista_propinas`;
// si está vacío, caemos al fallback para no perder propinas reales.
// Chequeamos ambos nombres de campo porque la API documentada usa
// `pagoventa_tipo`/`pagoventa_monto` pero el proxy puede entregarlos
// como `tipoPago`/`monto`.
export function sumPropinas(v: PosVenta): number {
  const list = v.lista_propinas ?? []
  let s = 0
  for (const p of list) s += num(p.montoConIgv)
  if (s > 0) return s
  const pagos = v.pagosList ?? []
  for (const p of pagos) {
    const raw = p as Record<string, unknown>
    const tipoStr = String(raw.tipoPago ?? raw.pagoventa_tipo ?? '').toLowerCase()
    if (tipoStr.includes('propina') || tipoStr.includes('tip')) {
      const monto = raw.monto ?? raw.pagoventa_monto
      s += num(monto as string | number | undefined)
    }
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
