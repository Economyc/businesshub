// Tipos compartidos del motor de P&L.
import type { LineSection } from './lines.ts'

/** Mapa linea → monto. Las claves son `LineDef['key']`. */
export type LineAmounts = Record<string, number>

/**
 * Una transaccion ya clasificada. La produce el clasificador en Node
 * (scripts/lib/pnl-template.mjs); el navegador nunca ve filas, solo mapas ya
 * agregados que vienen del snapshot.
 */
export interface ExpenseRow {
  line: string | null
  amount: number
  /** Retefuente practicada al proveedor: baja el neto girado, no el gasto. */
  withheld?: number
}

/**
 * Item capturado a mano (ajustes del extracto, ingresos no operacionales,
 * cuotas de diferidos). `accrued` y `paid` pueden diferir y ser NEGATIVOS:
 * hay contra-asientos de reparto de honorarios y de arriendo de mes vencido.
 */
export interface ManualItem {
  line: string
  concept: string
  accrued: number
  paid: number
  source?: string
}

/** Un lado del P&L (Causado o Pagado) con todos sus subtotales. */
export interface StatementSide {
  values: LineAmounts
  revenue: number
  cogs: number
  staff: number
  opex: number
  ebitda: number
  financial: number
  nonop: number
  pretax: number
  taxes: number
  net: number
  /** Fondo del 5% sobre la utilidad, solo si es positiva. */
  fund: number
  distributable: number
}

export interface Statement {
  accrued: StatementSide
  paid: StatementSide
}

export interface StatementInput {
  /** Venta por linea (solo las 4 `rev_*`). Igual en Causado y Pagado. */
  salesByLine: LineAmounts
  /** Impuesto al consumo facturado por el POS en el mes = la provision. */
  impoconsumo: number
  /** Gasto causado por linea, YA agregado y SIN `tax_impo`. */
  accruedByLine: LineAmounts
  /** Gasto pagado por linea, YA agregado y YA neto de retefuente. */
  paidByLine: LineAmounts
  manualItems: ManualItem[]
  nonOperatingItems: ManualItem[]
}

/** Un gasto pagado por anticipado que se reparte entre los meses que cubre. */
export interface Deferral {
  concept: string
  line: string
  total: number
  /** Primer mes que devenga, 'YYYY-MM'. */
  from: string
  months: number
  /** Mes en que salio la plata, 'YYYY-MM'. null si aun no se ha pagado. */
  paidOn?: string | null
  txId?: string | null
  source?: string
}

export interface SectionTotals {
  section: LineSection
  total: number
}
