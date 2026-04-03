import type { Timestamp } from 'firebase/firestore'
import type { Employee } from '@/modules/talent/types'
import { SMLMV, AUXILIO_TRANSPORTE } from '@/modules/payroll/types'
import {
  SETTLEMENT_TYPE_LABELS,
  type SettlementType,
  type SettlementConcept,
  type SettlementItem,
} from './types'

/* ─── Convencion colombiana 30/360 ─── */

function clampDay(d: number): number {
  return Math.min(d, 30)
}

/** Dias laborales entre dos fechas usando convencion 30/360 colombiana (inclusivo) */
export function daysBetween(start: Date, end: Date): number {
  const d1 = clampDay(start.getDate())
  const m1 = start.getMonth() + 1
  const y1 = start.getFullYear()
  const d2 = clampDay(end.getDate())
  const m2 = end.getMonth() + 1
  const y2 = end.getFullYear()
  // +1 porque ambas fechas son inclusivas en legislacion colombiana
  const days = (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1) + 1
  return Math.max(days, 0)
}

function toDate(ts: Timestamp | Date): Date {
  return ts instanceof Date ? ts : ts.toDate()
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/* ─── Auxilio de transporte ─── */

function calcAuxilio(salary: number): number {
  return salary <= SMLMV * 2 ? AUXILIO_TRANSPORTE : 0
}

/* ─── Formulas de prestaciones ─── */

export function calcPrima(salary: number, auxilio: number, days: number): number {
  return Math.round((salary + auxilio) * days / 360)
}

export function calcCesantias(salary: number, auxilio: number, days: number): number {
  return Math.round((salary + auxilio) * days / 360)
}

export function calcInteresesCesantias(cesantiasAmount: number, days: number): number {
  return Math.round(cesantiasAmount * days * 0.12 / 360)
}

export function calcVacaciones(salary: number, days: number): number {
  return Math.round(salary * days / 720)
}

/* ─── Logica de periodos ─── */

interface PeriodRange {
  start: Date
  end: Date
}

function getPeriodRange(type: SettlementType, year: number, employeeStart: Date, terminationDate?: Date): PeriodRange {
  const jan1 = new Date(year, 0, 1)
  const jul1 = new Date(year, 6, 1)
  const jun30 = new Date(year, 5, 30)
  const dec31 = new Date(year, 11, 31)
  const endDate = terminationDate ?? dec31

  switch (type) {
    case 'prima_junio':
      return { start: employeeStart > jan1 ? employeeStart : jan1, end: terminationDate ?? jun30 }
    case 'prima_diciembre':
      return { start: employeeStart > jul1 ? employeeStart : jul1, end: endDate }
    case 'cesantias':
    case 'intereses_cesantias':
      return { start: employeeStart > jan1 ? employeeStart : jan1, end: endDate }
    case 'vacaciones':
      return { start: employeeStart > jan1 ? employeeStart : jan1, end: endDate }
    case 'liquidacion_definitiva':
      return { start: jan1, end: endDate }
    default:
      return { start: jan1, end: endDate }
  }
}

/* ─── Calculo de un concepto individual ─── */

function buildConcept(
  type: SettlementType,
  salary: number,
  auxilio: number,
  period: PeriodRange,
): SettlementConcept {
  const days = daysBetween(period.start, period.end)
  let amount: number
  let formula: string

  switch (type) {
    case 'prima_junio':
    case 'prima_diciembre': {
      amount = calcPrima(salary, auxilio, days)
      formula = `($${(salary + auxilio).toLocaleString('es-CO')} x ${days} dias) / 360`
      break
    }
    case 'cesantias': {
      amount = calcCesantias(salary, auxilio, days)
      formula = `($${(salary + auxilio).toLocaleString('es-CO')} x ${days} dias) / 360`
      break
    }
    case 'intereses_cesantias': {
      const cesantias = calcCesantias(salary, auxilio, days)
      amount = calcInteresesCesantias(cesantias, days)
      formula = `($${cesantias.toLocaleString('es-CO')} x ${days} dias x 12%) / 360`
      break
    }
    case 'vacaciones': {
      amount = calcVacaciones(salary, days)
      formula = `($${salary.toLocaleString('es-CO')} x ${days} dias) / 720`
      break
    }
    default:
      amount = 0
      formula = ''
  }

  return {
    type,
    label: SETTLEMENT_TYPE_LABELS[type],
    baseSalary: salary,
    auxilioTransporte: type === 'vacaciones' ? 0 : auxilio,
    daysWorked: days,
    periodStart: formatDate(period.start),
    periodEnd: formatDate(period.end),
    amount,
    formula,
  }
}

/* ─── Orquestador principal ─── */

export function calculateSettlementItem(
  employee: Employee,
  type: SettlementType,
  year: number,
  terminationDate?: Date,
): SettlementItem {
  const salary = employee.salary
  const auxilio = calcAuxilio(salary)
  const empStart = toDate(employee.startDate)

  let concepts: SettlementConcept[]

  if (type === 'liquidacion_definitiva') {
    const termDate = terminationDate ?? new Date(year, 11, 31)
    // Prima proporcional desde ultimo corte
    const primaStart = termDate.getMonth() < 6
      ? new Date(year, 0, 1)
      : new Date(year, 6, 1)
    const primaPeriod: PeriodRange = {
      start: empStart > primaStart ? empStart : primaStart,
      end: termDate,
    }
    const primaType = termDate.getMonth() < 6 ? 'prima_junio' : 'prima_diciembre'

    // Cesantias desde enero 1
    const cesantiasPeriod = getPeriodRange('cesantias', year, empStart, termDate)
    // Vacaciones desde enero 1
    const vacaPeriod = getPeriodRange('vacaciones', year, empStart, termDate)

    const primaConcept = buildConcept(primaType, salary, auxilio, primaPeriod)
    const cesantiasConcept = buildConcept('cesantias', salary, auxilio, cesantiasPeriod)

    // Intereses sobre cesantias calculados usando el monto de cesantias
    const cesantiasDays = daysBetween(cesantiasPeriod.start, cesantiasPeriod.end)
    const interesesAmount = calcInteresesCesantias(cesantiasConcept.amount, cesantiasDays)
    const interesesConcept: SettlementConcept = {
      type: 'intereses_cesantias',
      label: SETTLEMENT_TYPE_LABELS.intereses_cesantias,
      baseSalary: salary,
      auxilioTransporte: auxilio,
      daysWorked: cesantiasDays,
      periodStart: formatDate(cesantiasPeriod.start),
      periodEnd: formatDate(cesantiasPeriod.end),
      amount: interesesAmount,
      formula: `($${cesantiasConcept.amount.toLocaleString('es-CO')} x ${cesantiasDays} dias x 12%) / 360`,
    }

    const vacaConcept = buildConcept('vacaciones', salary, 0, vacaPeriod)

    concepts = [
      { ...primaConcept, label: `Prima Proporcional (${SETTLEMENT_TYPE_LABELS[primaType]})` },
      cesantiasConcept,
      interesesConcept,
      vacaConcept,
    ]
  } else {
    const period = getPeriodRange(type, year, empStart, terminationDate)
    if (type === 'vacaciones') {
      concepts = [buildConcept(type, salary, 0, period)]
    } else {
      concepts = [buildConcept(type, salary, auxilio, period)]
    }
  }

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    employeeIdentification: employee.identification ?? '',
    employeeRole: employee.role,
    employeeDepartment: employee.department,
    salary,
    startDate: employee.startDate,
    concepts,
    totalAmount: concepts.reduce((sum, c) => sum + c.amount, 0),
  }
}

/* ─── Totales ─── */

export function calculateSettlementTotals(items: SettlementItem[]) {
  return {
    totalAmount: items.reduce((s, i) => s + i.totalAmount, 0),
    employeeCount: items.length,
  }
}
