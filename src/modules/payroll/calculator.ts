import type { Employee } from '@/modules/talent/types'
import {
  SMLMV,
  AUXILIO_TRANSPORTE,
  SALUD_EMPLEADO,
  PENSION_EMPLEADO,
  OVERTIME_RATES,
  type OvertimeEntry,
  type PayrollDeduction,
  type PayrollItem,
} from './types'

/** Horas ordinarias mensuales (48h/semana * 4.33 semanas) */
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

export function calculatePayrollItem(
  employee: Employee,
  overtime: OvertimeEntry[] = [],
  additionalDeductions: PayrollDeduction[] = [],
): PayrollItem {
  const baseSalary = employee.salary
  const auxilioTransporte = calcAuxilioTransporte(baseSalary)
  const overtimeTotal = Math.round(calcOvertimeTotal(baseSalary, overtime))

  // Base para aportes: salario + horas extras (auxilio transporte NO es base)
  const ibc = baseSalary + overtimeTotal
  const healthDeduction = Math.round(ibc * SALUD_EMPLEADO)
  const pensionDeduction = Math.round(ibc * PENSION_EMPLEADO)

  const additionalTotal = additionalDeductions.reduce((s, d) => s + d.amount, 0)
  const totalDeductions = healthDeduction + pensionDeduction + additionalTotal
  const totalEarnings = baseSalary + auxilioTransporte + overtimeTotal
  const netPay = totalEarnings - totalDeductions

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    employeeIdentification: employee.identification ?? '',
    employeeRole: employee.role,
    employeeDepartment: employee.department,
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
