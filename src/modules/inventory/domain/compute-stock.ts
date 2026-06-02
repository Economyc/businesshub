// Proyección de stock — NO contador mutable (ver plan §2). El stock actual de un
// insumo se DERIVA de eventos, así es idempotente ante re-sync del POS:
//
//   stock = último_conteo (anchor) + entradas − ajustes − consumo_teórico
//
// Cada argumento es un mapa ya agregado `{ itemId: cantidadEnUnidadDeStock }`.
// Función pura: recomputar con los mismos eventos da el mismo número. Sin Firebase.

export type ItemQtyMap = Record<string, number>

export interface ComputeStockInput {
  /** Cantidad del último conteo físico (verdad conocida en fecha T). */
  anchor?: ItemQtyMap
  /** Σ entradas/compras recibidas después de T. */
  receipts?: ItemQtyMap
  /** Σ ajustes (mermas, daños, traslados) después de T — se restan. */
  adjustments?: ItemQtyMap
  /** Σ consumo teórico (ventas POS × recetas) después de T — se resta. */
  consumption?: ItemQtyMap
}

export function computeStock(input: ComputeStockInput): ItemQtyMap {
  const { anchor = {}, receipts = {}, adjustments = {}, consumption = {} } = input

  // Universo de insumos presente en cualquiera de las fuentes.
  const itemIds = new Set<string>([
    ...Object.keys(anchor),
    ...Object.keys(receipts),
    ...Object.keys(adjustments),
    ...Object.keys(consumption),
  ])

  const out: ItemQtyMap = {}
  for (const id of itemIds) {
    out[id] =
      (anchor[id] ?? 0) +
      (receipts[id] ?? 0) -
      (adjustments[id] ?? 0) -
      (consumption[id] ?? 0)
  }
  return out
}
