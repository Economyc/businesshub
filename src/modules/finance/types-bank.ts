import type { Timestamp } from 'firebase/firestore'

// ── Modelo de datos del extracto bancario ───────────────────────────
// Estas colecciones NO las leen los hooks financieros (useIncomeStatement /
// useCashFlow). El extracto es materia prima para la conciliación (Fase 3);
// el P&L y el Flujo de Caja solo cambian cuando la conciliación crea
// `transactions` derivadas. Una cuenta/extracto por company (un local).

export type BankDirection = 'in' | 'out'

// Estado de conciliación de un movimiento (lo escribe la Fase 3):
//  - pending: aún no conciliado
//  - matched: cuadrado contra un cierre/POS, sin transacción derivada
//  - derived: generó transacción(es) derivada(s) (comisión Rappi, retención TC)
//  - partial: cuadre incompleto → requiere revisión humana (no inventar plata)
//  - ignored: movimiento no relevante (salida, traslado, etc.)
export type ReconcileStatus = 'pending' | 'matched' | 'derived' | 'partial' | 'ignored'

export type BankClassification = 'tarjeta_credito' | 'rappi' | 'otro'

export interface BankMovement {
  id: string
  date: Timestamp
  description: string
  reference?: string
  /** + entrada (abono) / − salida (cargo). */
  amount: number
  direction: BankDirection
  balance?: number
  /** Fila cruda del Excel/CSV tal como se parseó (para auditoría). */
  rawRow: Record<string, string>
  statementId: string
  bank?: string
  // ── Campos que escribe la conciliación (Fase 3) ──
  classification?: BankClassification
  reconcileStatus: ReconcileStatus
  matchedClosingId?: string
  derivedTransactionIds?: string[]
  /** Venta bruta Rappi del POS asociada (para derivar la comisión). */
  posGrossRappi?: number
  /** Comisión Rappi derivada = venta bruta POS − depósito neto banco. */
  derivedCommission?: number
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface BankStatement {
  id: string
  fileName: string
  bank: string
  periodStart: Timestamp
  periodEnd: Timestamp
  rowCount: number
  status: 'imported' | 'reconciled'
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

// ── Parseo en cliente ───────────────────────────────────────────────

export interface ParsedBankRow {
  /** ISO yyyy-mm-dd. */
  date: string
  description: string
  reference?: string
  /** Monto con signo (+ entrada / − salida). */
  amount: number
  direction: BankDirection
  balance?: number
  /** Fila cruda (columna → valor en texto). */
  raw: Record<string, string>
}

// Mapeo de columnas detectado por heurística de header. La UI puede
// sobreescribirlo y persistirlo en companies/{cid}/settings/bank-import.
export interface BankColumnMapping {
  date: string | null
  description: string | null
  reference: string | null
  /** Columna única con monto firmado (excluyente con debit/credit). */
  amount: string | null
  debit: string | null
  credit: string | null
  balance: string | null
}

export interface ParsedBankFile {
  rows: ParsedBankRow[]
  headers: string[]
  mapping: BankColumnMapping
  warnings: string[]
}
