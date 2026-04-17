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

// Fórmula canónica para "Ventas": total neto + propinas + costo de envío.
// Debe ser la única fuente de verdad usada en Home, POS Sync y cualquier otra vista.
export function ventaMonto(v: PosVenta): number {
  return num(v.total) + sumPropinas(v) + num(v.costoenvio)
}

export function cajaKey(v: PosVenta): string {
  return String(v.caja_id ?? '?')
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
  ticket: number
}

export function calcTotals(list: PosVenta[]): PosTotals {
  let ventasNetas = 0
  let propinas = 0
  let envio = 0
  let impuestos = 0
  for (const v of list) {
    ventasNetas += num(v.total)
    propinas += sumPropinas(v)
    envio += num(v.costoenvio)
    impuestos += num(v.impuestos)
  }
  const ventas = ventasNetas + propinas + envio
  return {
    count: list.length,
    ventas,
    ventasNetas,
    propinas,
    envio,
    impuestos,
    ticket: list.length > 0 ? ventas / list.length : 0,
  }
}
