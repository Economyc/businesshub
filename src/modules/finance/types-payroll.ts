import type { Timestamp } from 'firebase/firestore'
import type { AiUsageSnapshot } from './components/ai-usage-banner'

// ── Extracción IA (espejo de functions/src/analyze-payroll-document.ts) ──

export interface ColillaExtraction {
  employeeName: string
  identification: string
  role: string
  payPeriod: string
  totalDevengado: number
  totalDeducciones: number
  netoCancelado: number
}

export interface PropinaRowExtraction {
  employeeName: string
  amount: number
}

export interface PropinasExtraction {
  rows: PropinaRowExtraction[]
  total: number
}

export interface PayrollAnalyzeResponse<T> {
  kind: 'colilla' | 'propinas'
  extracted: T
  extractionFailed: boolean
  provider: string
  fallbackUsed: boolean
  usage?: AiUsageSnapshot
}

// ── Estado de UI por fila (revisión antes de registrar) ──

export interface EmployeeMatch {
  id: string
  name: string
  /** 1 = match exacto por cédula; <1 = similitud por nombre. */
  score: number
}

/** Fila de la tabla editable de Nómina (una por colilla cargada). */
export interface PayrollRowState {
  /** id local estable para React keys. */
  rowId: string
  file: File
  extracted: ColillaExtraction
  /** Empleado emparejado (editable por el usuario). */
  employeeId: string
  employeeName: string
  /** Valor que se contabiliza. Default = totalDevengado (costo real). */
  amountToPost: number
  include: boolean
  analyzeStatus: 'pending' | 'analyzing' | 'done' | 'failed'
  provider?: string
}

/** Fila de la tabla editable de Propinas. */
export interface TipRowState {
  rowId: string
  extracted: PropinaRowExtraction
  employeeId: string
  employeeName: string
  amount: number
  include: boolean
}

// ── Documentos resumen en Firestore ──

/** Quincena devengada: primera (Q1), segunda (Q2) o mes completo (full). */
export type Fortnight = 'Q1' | 'Q2' | 'full'

export interface PayrollBatchLine {
  employeeId: string
  employeeName: string
  identification: string
  totalDevengado: number
  totalDeducciones: number
  netoCancelado: number
  amountPosted: number
  transactionId: string
  driveFileId: string
  driveWebViewLink: string
}

export interface PayrollBatchDoc {
  periodKey: string
  periodLabel: string
  paidDate: Timestamp
  // Período devengado estructurado. periodLabel se autogenera a partir de estos.
  // Opcionales por retrocompatibilidad con lotes previos a la migración.
  accrualMonth?: string // 'YYYY-MM'
  fortnight?: Fortnight
  lines: PayrollBatchLine[]
  totalPosted: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface TipLine {
  employeeId: string
  employeeName: string
  amount: number
}

export interface TipDistributionDoc {
  periodKey: string
  periodLabel: string
  paidDate: Timestamp
  // Período devengado estructurado (ver PayrollBatchDoc).
  accrualMonth?: string // 'YYYY-MM'
  fortnight?: Fortnight
  lines: TipLine[]
  total: number
  transactionId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
