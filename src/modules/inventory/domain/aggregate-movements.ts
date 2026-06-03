// Agrega entradas (compras) y ajustes (mermas) a mapas `{ itemId: cantidadEnStock }`
// listos para alimentar computeStock. Funciones puras, sin Firebase/React.
//
// - Entradas: la cantidad viene en UNIDAD DE COMPRA del insumo → se convierte a stock
//   con su factor (`toStock`). Solo cuentan las recibidas DESPUÉS del conteo ancla.
// - Ajustes: el `qtyDelta` ya está en unidad de stock (positivo = sale). Solo los
//   ocurridos DESPUÉS del ancla.

import { toStock } from './units'
import type { ItemQtyMap } from './compute-stock'
import type { InventoryReceipt, InventoryAdjustment } from '../types'

/** Factor compra→stock por insumo (ausente = 1, sin conversión). */
export type FactorByItem = Record<string, number>

/**
 * Σ entradas posteriores a `sinceMillis`, en unidad de stock.
 * Cada línea se convierte con el factor del insumo (default 1 si no se conoce).
 */
export function aggregateReceipts(
  receipts: InventoryReceipt[],
  factorByItem: FactorByItem,
  sinceMillis: number,
): ItemQtyMap {
  const out: ItemQtyMap = {}
  for (const r of receipts) {
    if (r.receivedAt.toMillis() <= sinceMillis) continue
    for (const line of r.lines) {
      const qty = Number(line.qty)
      if (!Number.isFinite(qty) || qty <= 0) continue
      const factor = factorByItem[line.itemId] ?? 1
      out[line.itemId] = (out[line.itemId] ?? 0) + toStock(qty, factor)
    }
  }
  return out
}

/**
 * Σ ajustes (mermas/daños/traslados…) posteriores a `sinceMillis`, en unidad de stock.
 * El `qtyDelta` ya está en stock; se suman como positivos (computeStock los resta).
 */
export function aggregateAdjustments(
  adjustments: InventoryAdjustment[],
  sinceMillis: number,
): ItemQtyMap {
  const out: ItemQtyMap = {}
  for (const a of adjustments) {
    if (a.occurredAt.toMillis() <= sinceMillis) continue
    for (const line of a.lines) {
      const delta = Number(line.qtyDelta)
      if (!Number.isFinite(delta) || delta === 0) continue
      out[line.itemId] = (out[line.itemId] ?? 0) + delta
    }
  }
  return out
}
