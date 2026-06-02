import type { PurchaseUnit, StockUnit } from '../types'

// Catálogo de unidades de compra del restaurante. Cada una define:
// - la unidad de stock sugerida (cómo se cuenta/consume),
// - el factor compra→stock fijo (o null si depende del empaque y hay que preguntarlo).
// Datos puros, sin Firebase/React → testeable.

export interface PurchaseUnitDef {
  value: PurchaseUnit
  label: string
  /** Unidad de stock sugerida al elegir esta unidad de compra. */
  stockUnit: StockUnit
  /** Factor compra→stock fijo, o null si es un empaque cuyo contenido se pregunta. */
  factor: number | null
  /** True si es un empaque cuyo contenido (unidades por caja) se pregunta. */
  isPackaging: boolean
}

export const PURCHASE_UNITS: PurchaseUnitDef[] = [
  { value: 'gramos', label: 'Gramos', stockUnit: 'g', factor: 1, isPackaging: false },
  { value: 'kilogramos', label: 'Kilogramos', stockUnit: 'g', factor: 1000, isPackaging: false },
  { value: 'libra', label: 'Libra', stockUnit: 'g', factor: 500, isPackaging: false },
  { value: 'mililitros', label: 'Mililitros', stockUnit: 'ml', factor: 1, isPackaging: false },
  { value: 'litros', label: 'Litros', stockUnit: 'ml', factor: 1000, isPackaging: false },
  { value: 'caja', label: 'Caja', stockUnit: 'unidad', factor: null, isPackaging: true },
  { value: 'unidad', label: 'Unidad', stockUnit: 'unidad', factor: 1, isPackaging: false },
]

const BY_VALUE = new Map<string, PurchaseUnitDef>(PURCHASE_UNITS.map((u) => [u.value, u]))

export function getPurchaseUnit(value: string): PurchaseUnitDef | undefined {
  return BY_VALUE.get(value)
}

/** Label legible; cae al valor crudo si es un dato viejo fuera del catálogo. */
export function labelForPurchaseUnit(value: string): string {
  return BY_VALUE.get(value)?.label ?? value
}

const STOCK_UNIT_LABELS: Record<StockUnit, string> = {
  g: 'Gramos',
  ml: 'Mililitros',
  unidad: 'Unidades',
}

export function stockUnitLabel(unit: StockUnit): string {
  return STOCK_UNIT_LABELS[unit] ?? unit
}
