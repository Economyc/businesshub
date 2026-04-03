import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

/* ─── Tipos de liquidacion ─── */

export type SettlementType =
  | 'prima_junio'
  | 'prima_diciembre'
  | 'cesantias'
  | 'intereses_cesantias'
  | 'vacaciones'
  | 'liquidacion_definitiva'

export type SettlementStatus = 'draft' | 'approved' | 'paid'

export const SETTLEMENT_TYPE_LABELS: Record<SettlementType, string> = {
  prima_junio: 'Prima de Junio',
  prima_diciembre: 'Prima de Diciembre',
  cesantias: 'Cesantias',
  intereses_cesantias: 'Intereses sobre Cesantias',
  vacaciones: 'Vacaciones',
  liquidacion_definitiva: 'Liquidacion Definitiva',
}

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobada',
  paid: 'Pagada',
}

export const SETTLEMENT_STATUS_COLORS: Record<SettlementStatus, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

/* ─── Interfaces ─── */

export interface SettlementConcept {
  type: SettlementType
  label: string
  baseSalary: number
  auxilioTransporte: number
  daysWorked: number
  periodStart: string
  periodEnd: string
  amount: number
  formula: string
}

export interface SettlementItem {
  employeeId: string
  employeeName: string
  employeeIdentification: string
  employeeRole: string
  employeeDepartment: string
  salary: number
  startDate: Timestamp
  concepts: SettlementConcept[]
  totalAmount: number
}

export interface SettlementRecord extends BaseEntity {
  type: SettlementType
  typeLabel: string
  year: number
  periodLabel: string
  status: SettlementStatus
  items: SettlementItem[]
  totalAmount: number
  employeeCount: number
  notes?: string
  terminationDate?: string
}

export type SettlementFormData = Omit<SettlementRecord, 'id' | 'createdAt' | 'updatedAt'>
