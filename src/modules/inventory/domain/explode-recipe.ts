import type { Recipe } from '../types'

// Explosión recursiva de una receta a su consumo de INSUMOS (no preparaciones).
//
// Una receta de producto puede usar insumos directos (kind='item') y preparaciones
// (kind='preparation', p.ej. una salsa que a su vez tiene su receta). Una preparación
// rinde `yieldQty` porciones; para producir la cantidad pedida se escala su receta.
//
// Función pura: dada una receta + el mapa de preparaciones + porciones vendidas,
// devuelve `{ itemId: cantidadEnUnidadDeStock }`. Sin Firebase/React.

export interface ExplodeInput {
  recipe: Recipe
  /** Recetas de preparación indexadas por su id (las que `kind='preparation'` referencian). */
  preparationsById: Record<string, Recipe>
  /** Porciones vendidas del producto (cantidad_vendida del POS). Default 1. */
  portions?: number
}

export type ItemConsumption = Record<string, number>

export function explodeRecipe({ recipe, preparationsById, portions = 1 }: ExplodeInput): ItemConsumption {
  const out: ItemConsumption = {}
  explode(recipe, preparationsById, portions, new Set(), out)
  return out
}

function explode(
  recipe: Recipe,
  prepsById: Record<string, Recipe>,
  portions: number,
  seen: Set<string>,
  out: ItemConsumption,
): void {
  for (const c of recipe.components) {
    const wasteMult = c.wasteFactor && c.wasteFactor > 0 ? 1 + c.wasteFactor : 1
    const effectiveQty = c.qty * portions * wasteMult

    if (c.kind === 'item') {
      out[c.refId] = (out[c.refId] ?? 0) + effectiveQty
      continue
    }

    // kind === 'preparation'
    if (seen.has(c.refId)) continue // corta ciclos (salsa que se referencia a sí misma)
    const prep = prepsById[c.refId]
    if (!prep) continue // preparación sin receta definida → se ignora (UI lo marca como warning aparte)

    const yieldQty = prep.yieldQty && prep.yieldQty > 0 ? prep.yieldQty : 1
    const subPortions = effectiveQty / yieldQty
    explode(prep, prepsById, subPortions, new Set([...seen, c.refId]), out)
  }
}
