import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

// Unidad en la que se cuenta y consume el insumo (la "unidad de stock").
export type StockUnit = 'g' | 'ml' | 'unidad'

// Unidad en la que se COMPRA el insumo. Catálogo cerrado (ver domain/purchase-units).
// Las métricas convierten con factor fijo a la unidad de stock; 'caja' es un empaque
// cuyo contenido se pregunta (unidades por caja).
export type PurchaseUnit = 'gramos' | 'kilogramos' | 'libra' | 'mililitros' | 'litros' | 'caja' | 'unidad'

// Insumo / materia prima. Se compra en una unidad (caja, kg, bolsa) y se consume
// en otra (g, ml, unidad) → `purchaseToStockFactor` convierte compra → stock.
// El stock NO se guarda aquí: es una proyección (ver domain/compute-stock).
export interface InventoryItem extends BaseEntity {
  name: string
  category: string
  stockUnit: StockUnit
  /** Unidad en la que se compra (catálogo cerrado). */
  purchaseUnit: PurchaseUnit
  /** Cuántas unidades de stock entran en 1 unidad de compra (ej: 1 caja = 5000 g → 5000). */
  purchaseToStockFactor: number
  /** Costo por unidad de compra (COP). Opcional al inicio; necesario para variance en $. */
  unitCost?: number
  /** Stock mínimo (par level) en unidad de stock: dispara la sugerencia de reorden. */
  parLevel?: number
  /** Cantidad sugerida a pedir (en unidad de compra) cuando se cae bajo el par. */
  reorderQty?: number
  /** Proveedor preferido — id en la colección raíz `suppliers`. */
  supplierId?: string
  active: boolean
  /** Bitácora de cambios de costo (auto-actualizados al registrar una Entrada con costo distinto). */
  costHistory?: ItemCostChange[]
}

/** Categoría de insumo. Catálogo editable per-company (lo gestiona el Owner). */
export interface InventoryCategory extends BaseEntity {
  name: string
}

export type InventoryCategoryFormData = Omit<InventoryCategory, 'id' | 'createdAt' | 'updatedAt'>

/** Registro de un cambio de `unitCost` de un insumo (Fase 4: lo dispara una Entrada). */
export interface ItemCostChange {
  at: Timestamp
  previousCost: number
  newCost: number
  /** Entrada que originó el cambio, si aplica. */
  receiptId?: string
}

export type InventoryItemFormData = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>

// ---- Recetas (BOM) — usadas desde Fase 2; tipadas ya para el dominio puro ----

export type RecipeComponentKind = 'item' | 'preparation'

export interface RecipeComponent {
  kind: RecipeComponentKind
  /** id del InventoryItem (kind='item') o de la Recipe de preparación (kind='preparation'). */
  refId: string
  /** Cantidad por porción: en unidad de stock si es item; en unidades de yield si es preparación. */
  qty: number
  /** Merma de preparación (0.1 = 10% extra). Opcional. */
  wasteFactor?: number
}

/** Llave de join contra el catálogo del POS (ver Spike 0: id_producto == producto_id == productogeneral_id). */
export interface PosProductKey {
  presentationId: string
  productGeneralId: string
  name: string
}

export type RecipeType = 'product' | 'preparation'

export interface Recipe extends BaseEntity {
  /** Presente en recetas de producto vendible; ausente en preparaciones internas. */
  posProductKey?: PosProductKey
  /** Nombre de la preparación (type='preparation'). Las recetas de producto usan posProductKey.name. */
  name?: string
  type: RecipeType
  /** Porciones que rinde una preparación (salsa que rinde N). Solo type='preparation'. */
  yieldQty?: number
  components: RecipeComponent[]
  active: boolean
}

export type RecipeFormData = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

// ---- Movimientos del ledger (usados desde Fase 4/5) ----

export interface InventoryCountLine {
  itemId: string
  qty: number
}

export interface InventoryCount extends BaseEntity {
  countedAt: Timestamp
  countedBy: string
  lines: InventoryCountLine[]
  status: 'draft' | 'final'
}

export type InventoryCountFormData = Omit<InventoryCount, 'id' | 'createdAt' | 'updatedAt'>

export interface InventoryReceiptLine {
  itemId: string
  qty: number
  unitCost?: number
}

export interface InventoryReceipt extends BaseEntity {
  receivedAt: Timestamp
  supplierId?: string
  invoiceRef?: string
  lines: InventoryReceiptLine[]
}

export type InventoryReceiptFormData = Omit<InventoryReceipt, 'id' | 'createdAt' | 'updatedAt'>

export type AdjustmentType = 'merma' | 'daño' | 'cortesía' | 'traslado' | 'corrección'

export interface InventoryAdjustmentLine {
  itemId: string
  /** Delta en unidad de stock (positivo = sale del inventario, p.ej. merma). */
  qtyDelta: number
  reason?: string
}

export interface InventoryAdjustment extends BaseEntity {
  occurredAt: Timestamp
  type: AdjustmentType
  lines: InventoryAdjustmentLine[]
  by: string
}

export type InventoryAdjustmentFormData = Omit<InventoryAdjustment, 'id' | 'createdAt' | 'updatedAt'>
