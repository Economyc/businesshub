// Diferencias de un conteo físico vs el stock esperado (proyectado).
//
//   diferencia = contado − esperado
//   negativa → FALTANTE (hay menos físico de lo que el sistema dice)
//   positiva → SOBRANTE (hay más físico de lo que el sistema dice)
//
// Función pura: recibe los insumos activos, las líneas del conteo y el mapa de
// stock esperado (ver domain/compute-stock). Sin Firebase/React. Lista TODOS los
// insumos activos (no solo los contados) para que un insumo olvidado se vea como
// faltante en vez de romper silenciosamente el ancla del stock.

import { costPerStockUnit } from './units'
import type { InventoryItem, InventoryCountLine } from '../types'

/** Ruido de punto flotante del consumo teórico (fraccionario) que NO es diferencia real. */
export const VARIANCE_EPSILON = 0.001

export type VarianceKind = 'faltante' | 'sobrante' | 'igual'

export interface VarianceRow {
  itemId: string
  name: string
  category: string
  unit: string
  expected: number
  counted: number
  /** contado − esperado. */
  diff: number
  /** diff × costo por unidad de stock; null si el insumo no tiene costo cargado. */
  diffValue: number | null
  kind: VarianceKind
  /** El insumo activo no se incluyó en el conteo (≠ contado en 0). */
  notCounted: boolean
}

export interface VarianceTotals {
  /** Σ del valor de los faltantes, en positivo. */
  shortageValue: number
  /** Σ del valor de los sobrantes. */
  overageValue: number
  /** overage − shortage (puede ser negativo). */
  netValue: number
  /** Cuántos insumos tienen diferencia real. */
  itemsWithDiff: number
}

export interface ComputeVarianceInput {
  /** Insumos activos a evaluar. */
  items: InventoryItem[]
  /** Líneas del conteo a revisar ({ itemId, qty }). */
  countLines: InventoryCountLine[]
  /** Stock esperado por insumo (proyección). */
  expectedStock: Record<string, number>
}

export interface ComputeVarianceResult {
  rows: VarianceRow[]
  totals: VarianceTotals
  /** Hay al menos un insumo con diferencia real (|diff| > EPSILON). */
  hasDifferences: boolean
  /** Insumos activos que no se contaron (su stock arrancaría en 0 al aprobar). */
  notCountedCount: number
}

export function computeVariance({
  items,
  countLines,
  expectedStock,
}: ComputeVarianceInput): ComputeVarianceResult {
  const countedById = new Map<string, number>()
  for (const line of countLines) countedById.set(line.itemId, line.qty)

  const rows: VarianceRow[] = []
  let shortageValue = 0
  let overageValue = 0
  let itemsWithDiff = 0
  let notCountedCount = 0

  for (const item of items) {
    if (item.active === false) continue

    const notCounted = !countedById.has(item.id)
    const counted = countedById.get(item.id) ?? 0
    const expected = expectedStock[item.id] ?? 0
    const diff = counted - expected

    const hasCost = item.unitCost != null && item.unitCost > 0
    const diffValue = hasCost ? diff * costPerStockUnit(item.unitCost!, item.purchaseToStockFactor) : null

    let kind: VarianceKind = 'igual'
    if (Math.abs(diff) > VARIANCE_EPSILON) kind = diff < 0 ? 'faltante' : 'sobrante'

    if (kind !== 'igual') {
      itemsWithDiff += 1
      if (diffValue != null) {
        if (diff < 0) shortageValue += -diffValue
        else overageValue += diffValue
      }
    }
    if (notCounted) notCountedCount += 1

    rows.push({
      itemId: item.id,
      name: item.name,
      category: item.category ?? '',
      unit: item.stockUnit,
      expected,
      counted,
      diff,
      diffValue,
      kind,
      notCounted,
    })
  }

  // Mayor diferencia (en valor absoluto de $; sin costo al final) primero.
  rows.sort((a, b) => {
    const av = a.diffValue != null ? Math.abs(a.diffValue) : -1
    const bv = b.diffValue != null ? Math.abs(b.diffValue) : -1
    if (av !== bv) return bv - av
    return a.name.localeCompare(b.name, 'es')
  })

  return {
    rows,
    totals: {
      shortageValue,
      overageValue,
      netValue: overageValue - shortageValue,
      itemsWithDiff,
    },
    hasDifferences: itemsWithDiff > 0,
    notCountedCount,
  }
}
