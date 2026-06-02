import type { InventoryItem, Recipe } from '../types'
import { explodeRecipe } from './explode-recipe'
import { costPerStockUnit } from './units'

// Costeo de una receta a partir de su explosión a insumos.
//
// Reusa `explodeRecipe` (consumo de insumos en unidad de stock, ya con
// preparaciones anidadas/wasteFactor/ciclos resueltos) y `costPerStockUnit`
// (costo del insumo por unidad de stock). Función pura: sin Firebase/React.
//
// Un insumo sin `unitCost` (o ausente del catálogo) NO suma al total y queda
// listado en `missingCostItemIds` → el costeo se marca incompleto.

export interface CostRecipeInput {
  recipe: Recipe
  /** Insumos indexados por id (para costo y nombre de cada componente). */
  itemsById: Record<string, InventoryItem>
  /** Recetas de preparación indexadas por id (para la explosión anidada). */
  preparationsById: Record<string, Recipe>
  /** Porciones a costear. Default 1 (costo unitario de la receta). */
  portions?: number
  /** Precio de venta de la presentación POS, para calcular margen. Opcional. */
  salePrice?: number
}

export interface CostLine {
  itemId: string
  /** Nombre del insumo; cae al id si el insumo fue borrado del catálogo. */
  name: string
  /** Cantidad explotada en unidad de stock. */
  qty: number
  stockUnit: string
  costPerStockUnit: number
  /** qty * costPerStockUnit (0 si el insumo no tiene costo). */
  lineCost: number
  /** false si el insumo no tiene unitCost o no está en el catálogo. */
  hasCost: boolean
}

export interface CostRecipeResult {
  /** Suma de lineCost (cuenta solo líneas con costo). */
  totalCost: number
  /** Líneas de costeo ordenadas desc por lineCost. */
  lines: CostLine[]
  /** Ids de insumos sin costo → costeo incompleto. */
  missingCostItemIds: string[]
  isComplete: boolean
  /** salePrice - totalCost (solo si salePrice > 0). */
  margin?: number
  /** Margen como % del precio de venta (solo si salePrice > 0). */
  marginPct?: number
}

export function costRecipe({
  recipe,
  itemsById,
  preparationsById,
  portions = 1,
  salePrice,
}: CostRecipeInput): CostRecipeResult {
  const consumption = explodeRecipe({ recipe, preparationsById, portions })

  const lines: CostLine[] = []
  const missingCostItemIds: string[] = []
  let totalCost = 0

  for (const [itemId, qty] of Object.entries(consumption)) {
    const item = itemsById[itemId]
    const cpu =
      item?.unitCost != null ? costPerStockUnit(item.unitCost, item.purchaseToStockFactor) : 0
    const hasCost = item?.unitCost != null && cpu > 0
    const lineCost = hasCost ? qty * cpu : 0

    if (hasCost) totalCost += lineCost
    else missingCostItemIds.push(itemId)

    lines.push({
      itemId,
      name: item?.name ?? itemId,
      qty,
      stockUnit: item?.stockUnit ?? '',
      costPerStockUnit: cpu,
      lineCost,
      hasCost,
    })
  }

  lines.sort((a, b) => b.lineCost - a.lineCost)

  const result: CostRecipeResult = {
    totalCost,
    lines,
    missingCostItemIds,
    isComplete: missingCostItemIds.length === 0,
  }

  if (salePrice != null && salePrice > 0) {
    result.margin = salePrice - totalCost
    result.marginPct = ((salePrice - totalCost) / salePrice) * 100
  }

  return result
}
