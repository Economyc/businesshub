// Conversión entre la unidad de compra y la unidad de stock de un insumo.
//
// `factor` = cuántas unidades de stock hay en 1 unidad de compra
// (ej: 1 caja = 5000 g  → factor 5000). Función pura, sin Firebase/React.

/** Convierte una cantidad expresada en unidad de compra a unidad de stock. */
export function toStock(qtyPurchase: number, factor: number): number {
  return qtyPurchase * factor
}

/** Convierte una cantidad en unidad de stock a unidad de compra. */
export function toPurchase(qtyStock: number, factor: number): number {
  if (factor <= 0) return 0
  return qtyStock / factor
}

/**
 * Cuántas unidades de compra hay que pedir para alcanzar (al menos) `targetStock`,
 * redondeado hacia arriba a unidad de compra entera. Base de la sugerencia de reorden.
 */
export function purchaseUnitsToCover(targetStock: number, factor: number): number {
  if (factor <= 0 || targetStock <= 0) return 0
  return Math.ceil(targetStock / factor)
}
