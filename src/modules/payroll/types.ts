import type { BaseEntity } from '@/core/types'

/* ─── Constantes colombianas 2026 ─── */
export const SMLMV = 1_423_500
export const AUXILIO_TRANSPORTE = 200_000
export const SALUD_EMPLEADO = 0.04
export const PENSION_EMPLEADO = 0.04

/* ─── Recargos sobre valor hora ordinaria ─── */
export const OVERTIME_RATES = {
  diurna: 1.25,
  nocturna: 1.75,
  dominical_diurna: 2.0,
  dominical_nocturna: 2.5,
} as const

export type OvertimeType = keyof typeof OVERTIME_RATES

export const OVERTIME_LABELS: Record<OvertimeType, string> = {
  diurna: 'Extra Diurna (+25%)',
  nocturna: 'Extra Nocturna (+75%)',
  dominical_diurna: 'Dominical Diurna (+100%)',
  dominical_nocturna: 'Dominical Nocturna (+150%)',
}

/* ─── Interfaces ─── */

export interface OvertimeEntry {
  type: OvertimeType
  hours: number
}

export interface PayrollDeduction {
  concept: string
  percentage?: number
  amount: number
}

export interface PayrollItem {
  employeeId: string
  employeeName: string
  employeeIdentification: string
  employeeRole: string
  employeeDepartment: string
  baseSalary: number
  auxilioTransporte: number
  overtime: OvertimeEntry[]
  overtimeTotal: number
  additionalDeductions: PayrollDeduction[]
  healthDeduction: number
  pensionDeduction: number
  totalDeductions: number
  totalEarnings: number
  netPay: number
}

export type PayrollStatus = 'draft' | 'approved' | 'paid'

export interface PayrollRecord extends BaseEntity {
  year: number
  month: number
  periodLabel: string
  status: PayrollStatus
  items: PayrollItem[]
  totalBaseSalary: number
  totalAuxilio: number
  totalOvertime: number
  totalDeductions: number
  totalEarnings: number
  totalNetPay: number
  employeeCount: number
  notes?: string
  transactionCreated?: boolean
}

export type PayrollFormData = Omit<PayrollRecord, 'id' | 'createdAt' | 'updatedAt'>

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const
