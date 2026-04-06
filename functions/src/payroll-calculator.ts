/* ─── Constantes colombianas 2026 ─── */
export const SMLMV = 1_423_500
export const AUXILIO_TRANSPORTE = 200_000
export const SALUD_EMPLEADO = 0.04
export const PENSION_EMPLEADO = 0.04

export const OVERTIME_RATES = {
  diurna: 1.25,
  nocturna: 1.75,
  dominical_diurna: 2.0,
  dominical_nocturna: 2.5,
} as const

export type OvertimeType = keyof typeof OVERTIME_RATES

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

/* ─── Cálculos ─── */

const MONTHLY_HOURS = 240

function calcHourlyRate(baseSalary: number): number {
  return baseSalary / MONTHLY_HOURS
}

function calcOvertimeTotal(baseSalary: number, overtime: OvertimeEntry[]): number {
  const hourly = calcHourlyRate(baseSalary)
  return overtime.reduce((sum, entry) => {
    return sum + hourly * OVERTIME_RATES[entry.type] * entry.hours
  }, 0)
}

function calcAuxilioTransporte(baseSalary: number): number {
  return baseSalary <= SMLMV * 2 ? AUXILIO_TRANSPORTE : 0
}

/**
 * Calcula la nómina de un empleado a partir de datos raw de Firestore.
 * Compatible con el formato Record<string, unknown> del Admin SDK.
 */
export function calculatePayrollItemFromRaw(
  employee: Record<string, unknown>,
  overtime: OvertimeEntry[] = [],
  additionalDeductions: PayrollDeduction[] = [],
): PayrollItem {
  const baseSalary = Number(employee.salary) || 0
  const auxilioTransporte = calcAuxilioTransporte(baseSalary)
  const overtimeTotal = Math.round(calcOvertimeTotal(baseSalary, overtime))

  const ibc = baseSalary + overtimeTotal
  const healthDeduction = Math.round(ibc * SALUD_EMPLEADO)
  const pensionDeduction = Math.round(ibc * PENSION_EMPLEADO)

  const additionalTotal = additionalDeductions.reduce((s, d) => s + d.amount, 0)
  const totalDeductions = healthDeduction + pensionDeduction + additionalTotal
  const totalEarnings = baseSalary + auxilioTransporte + overtimeTotal
  const netPay = totalEarnings - totalDeductions

  return {
    employeeId: String(employee.id ?? ''),
    employeeName: String(employee.name ?? ''),
    employeeIdentification: String(employee.identification ?? ''),
    employeeRole: String(employee.role ?? ''),
    employeeDepartment: String(employee.department ?? ''),
    baseSalary,
    auxilioTransporte,
    overtime,
    overtimeTotal,
    additionalDeductions,
    healthDeduction,
    pensionDeduction,
    totalDeductions,
    totalEarnings,
    netPay,
  }
}

export function calculatePayrollTotals(items: PayrollItem[]) {
  return {
    totalBaseSalary: items.reduce((s, i) => s + i.baseSalary, 0),
    totalAuxilio: items.reduce((s, i) => s + i.auxilioTransporte, 0),
    totalOvertime: items.reduce((s, i) => s + i.overtimeTotal, 0),
    totalDeductions: items.reduce((s, i) => s + i.totalDeductions, 0),
    totalEarnings: items.reduce((s, i) => s + i.totalEarnings, 0),
    totalNetPay: items.reduce((s, i) => s + i.netPay, 0),
    employeeCount: items.length,
  }
}
