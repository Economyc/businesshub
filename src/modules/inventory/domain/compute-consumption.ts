import type { Recipe } from '../types'
import { explodeRecipe } from './explode-recipe'

// Agrega el consumo teórico de insumos a partir de las ventas del POS de un período.
// Cada línea de venta (un producto vendido N veces) se explota a su receta vía
// explodeRecipe y se acumula por insumo. Las ventas cuyo producto no tiene receta
// indexada se reportan aparte (`unmapped`) para que la UI sugiera crearlas.
//
// Función pura: recibe líneas YA filtradas (sin anuladas) y parseadas a número,
// igual que cost-recipe/explode-recipe evitan acoplarse a Firebase/POS. El parseo
// de strings del POS y el filtro de anuladas viven en el componente (stock-tab).

/** Línea de venta mínima que el dominio necesita (desacoplada de PosVentaItem). */
export interface ConsumptionSaleLine {
  /** = PosVentaItem.id_producto, join contra Recipe.posProductKey.presentationId. */
  presentationId: string
  /** = PosVentaItem.nombre_producto, para listar "vendido sin receta". */
  productName: string
  /** Porciones vendidas (= Number(cantidad_vendida)). */
  qty: number
  /** Ingreso de la línea (= Number(venta_total)), para priorizar el unmapped. */
  lineRevenue: number
}

export interface ComputeConsumptionInput {
  saleLines: ConsumptionSaleLine[]
  /** Recetas de producto indexadas por presentationId (posProductKey.presentationId). */
  recipeByPresentation: Map<string, Recipe>
  /** Recetas de preparación por id (para explodeRecipe). */
  preparationsById: Record<string, Recipe>
}

/** Un producto vendido en el período que NO tiene receta indexada. */
export interface UnmappedSale {
  presentationId: string
  productName: string
  units: number
  revenue: number
}

export interface ComputeConsumptionResult {
  /** Consumo teórico total por insumo en unidad de stock → computeStock({ consumption }). */
  consumption: Record<string, number>
  /** Productos vendidos sin receta, ordenados por revenue desc. */
  unmapped: UnmappedSale[]
  /** Porciones vendidas por presentationId (alimenta el cálculo de "alcanza para"). */
  portionsByPresentation: Record<string, number>
}

export function computeConsumption({
  saleLines,
  recipeByPresentation,
  preparationsById,
}: ComputeConsumptionInput): ComputeConsumptionResult {
  const consumption: Record<string, number> = {}
  const portionsByPresentation: Record<string, number> = {}
  const unmappedMap = new Map<string, UnmappedSale>()

  for (const line of saleLines) {
    const qty = Number.isFinite(line.qty) ? line.qty : 0
    if (qty <= 0) continue

    const recipe = recipeByPresentation.get(line.presentationId)
    if (!recipe) {
      const prev = unmappedMap.get(line.presentationId)
      const revenue = Number.isFinite(line.lineRevenue) ? line.lineRevenue : 0
      if (prev) {
        prev.units += qty
        prev.revenue += revenue
        if (!prev.productName && line.productName) prev.productName = line.productName
      } else {
        unmappedMap.set(line.presentationId, {
          presentationId: line.presentationId,
          productName: line.productName,
          units: qty,
          revenue,
        })
      }
      continue
    }

    portionsByPresentation[line.presentationId] =
      (portionsByPresentation[line.presentationId] ?? 0) + qty

    const exploded = explodeRecipe({ recipe, preparationsById, portions: qty })
    for (const [itemId, itemQty] of Object.entries(exploded)) {
      consumption[itemId] = (consumption[itemId] ?? 0) + itemQty
    }
  }

  const unmapped = [...unmappedMap.values()].sort((a, b) => b.revenue - a.revenue)

  return { consumption, unmapped, portionsByPresentation }
}
