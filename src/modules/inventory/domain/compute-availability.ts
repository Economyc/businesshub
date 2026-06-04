// Disponibilidad de producción — cuántas porciones/lotes se pueden producir HOY
// con el stock proyectado, usando el CUELLO DE BOTELLA real (el insumo que se
// agota primero al explotar toda la receta, incluidas preparaciones anidadas).
//
//   disponibles = floor( min sobre insumos de  stock[itemId] / qtyPorUnidad )
//
// Función pura: reusa explodeRecipe + computeStock. Sin Firebase/React.

import type { Recipe } from '../types'
import { explodeRecipe, type ItemConsumption } from './explode-recipe'
import type { ItemQtyMap } from './compute-stock'

export interface AvailabilityResult {
  /** Unidades enteras (porciones de producto o lotes de preparación) producibles. */
  units: number
  /** Insumo que define el cuello de botella (el de menor ratio stock/qty). */
  limitingItemId?: string
  /** true si la receta no tiene insumos o algún insumo requerido no alcanza para 1. */
  blocked: boolean
}

/**
 * Dado el consumo de insumos por UNIDAD (1 porción / 1 lote) y el stock actual,
 * cuántas unidades enteras alcanzan y cuál insumo es el cuello de botella.
 */
export function availableFromPerUnit(perUnit: ItemConsumption, stock: ItemQtyMap): AvailabilityResult {
  const entries = Object.entries(perUnit).filter(([, qty]) => qty > 0)
  if (entries.length === 0) return { units: 0, blocked: true }

  let minRatio = Infinity
  let limitingItemId: string | undefined
  for (const [itemId, qty] of entries) {
    const level = stock[itemId] ?? 0
    const ratio = level / qty
    if (ratio < minRatio) {
      minRatio = ratio
      limitingItemId = itemId
    }
  }

  const units = Number.isFinite(minRatio) ? Math.floor(minRatio) : 0
  return { units, limitingItemId, blocked: units <= 0 }
}

export interface ProductAvailabilityRow {
  recipeId: string
  presentationId: string
  name: string
  /** Porciones vendibles producibles con el stock actual. */
  available: number
  limitingItemId?: string
  blocked: boolean
}

export interface PreparationAvailabilityRow {
  recipeId: string
  name: string
  yieldQty: number
  /** Lotes enteros producibles. */
  batches: number
  /** Porciones producibles = batches * yieldQty. */
  portions: number
  limitingItemId?: string
  blocked: boolean
}

interface AvailabilityArgs {
  recipes: Recipe[]
  preparationsById: Record<string, Recipe>
  stock: ItemQtyMap
}

/** Disponibilidad por producto vendible (type='product' con posProductKey). */
export function computeProductAvailability({
  recipes,
  preparationsById,
  stock,
}: AvailabilityArgs): ProductAvailabilityRow[] {
  const rows: ProductAvailabilityRow[] = []
  for (const recipe of recipes) {
    if (recipe.type !== 'product' || !recipe.posProductKey) continue
    const perPortion = explodeRecipe({ recipe, preparationsById, portions: 1 })
    const { units, limitingItemId, blocked } = availableFromPerUnit(perPortion, stock)
    rows.push({
      recipeId: recipe.id,
      presentationId: recipe.posProductKey.presentationId,
      name: recipe.posProductKey.name,
      available: units,
      limitingItemId,
      blocked,
    })
  }
  return rows.sort((a, b) => a.available - b.available || a.name.localeCompare(b.name, 'es'))
}

/** Disponibilidad por preparación interna (type='preparation'). */
export function computePreparationAvailability({
  recipes,
  preparationsById,
  stock,
}: AvailabilityArgs): PreparationAvailabilityRow[] {
  const rows: PreparationAvailabilityRow[] = []
  for (const recipe of recipes) {
    if (recipe.type !== 'preparation') continue
    // explodeRecipe sobre una preparación con portions=1 = insumos para 1 LOTE
    // completo (sus components.qty están definidos para rendir yieldQty porciones).
    const perBatch = explodeRecipe({ recipe, preparationsById, portions: 1 })
    const { units, limitingItemId, blocked } = availableFromPerUnit(perBatch, stock)
    const yieldQty = recipe.yieldQty && recipe.yieldQty > 0 ? recipe.yieldQty : 1
    rows.push({
      recipeId: recipe.id,
      name: recipe.name ?? '',
      yieldQty,
      batches: units,
      portions: units * yieldQty,
      limitingItemId,
      blocked,
    })
  }
  return rows.sort((a, b) => a.batches - b.batches || a.name.localeCompare(b.name, 'es'))
}
