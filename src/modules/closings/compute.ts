import type { Closing } from './types'

type VentaTotalInput = Pick<Closing, 'ap' | 'qr' | 'datafono' | 'rappiVentas' | 'efectivo'>

/** Venta total canónica de un cierre: QR + Datáfono + Rappi + efectivo neto (Efectivo − Apertura, sin negativos). */
export function computeVentaTotal(c: Partial<VentaTotalInput>): number {
  return (
    (c.qr ?? 0) +
    (c.datafono ?? 0) +
    (c.rappiVentas ?? 0) +
    Math.max((c.efectivo ?? 0) - (c.ap ?? 0), 0)
  )
}
