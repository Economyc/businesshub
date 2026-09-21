// Armado del P&L. Aritmetica pura: corre igual en el script (Node, sobre el
// barrido de Firestore) y en el navegador (sobre el snapshot publicado).
//
// La separacion entre agregar filas y armar el estado es lo que permite las dos
// cosas: el script agrega las filas y publica los mapas; el navegador recibe los
// mapas ya hechos y solo suma encima lo capturado. Ambos llaman a
// `buildStatement`, asi que no pueden divergir.

import { LINES, REVENUE_KEYS, linesOf, emptyLineAmounts } from './lines.ts'
import type { LineAmounts, ExpenseRow, ManualItem, StatementSide, Statement, StatementInput } from './types.ts'

/**
 * Agrega el gasto CAUSADO por linea.
 *
 * Salta `tax_impo` a proposito: el impoconsumo se declara y paga por bimestres
 * vencidos, asi que el giro que sale en julio liquida mayo-junio y no devenga en
 * el mes en que se paga. Lo que devenga es la provision, que `buildStatement`
 * toma de la venta del POS.
 */
export function aggregateAccrued(rows: ExpenseRow[]): LineAmounts {
  const acc = emptyLineAmounts()
  for (const r of rows) {
    if (!r.line) continue
    if (r.line === 'tax_impo') continue
    acc[r.line] += r.amount
  }
  return acc
}

/**
 * Agrega el gasto PAGADO por linea: el bruto menos la retefuente practicada,
 * que es lo que de verdad salio de la cuenta (esa parte se le debe a la DIAN,
 * no al proveedor). El causado se queda con el bruto: el gasto es el mismo.
 */
export function aggregatePaid(rows: ExpenseRow[]): LineAmounts {
  const acc = emptyLineAmounts()
  for (const r of rows) {
    if (!r.line) continue
    acc[r.line] += r.amount - (r.withheld ?? 0)
  }
  return acc
}

function buildSide(obj: LineAmounts): StatementSide {
  const sum = (section: Parameters<typeof linesOf>[0]): number =>
    linesOf(section).reduce((s, l) => s + obj[l.key], 0)

  const revenue = sum('revenue')
  const cogs = sum('cogs')
  const staff = sum('staff')
  const opex = sum('opex')
  const ebitda = revenue - cogs - staff - opex
  // Los ingresos financieros restan del gasto financiero neto.
  const financial = obj.fin_expense - obj.fin_income
  // Lo no operacional entra DESPUES del EBITDA: el EBITDA sigue midiendo solo
  // la operacion, que es para lo que sirve. La utilidad si lo incluye, porque
  // esa plata es del negocio.
  const nonop = sum('nonop')
  const pretax = ebitda - financial + nonop
  const taxes = sum('taxes')
  const net = pretax - taxes
  const fund = net > 0 ? net * 0.05 : 0
  return { values: obj, revenue, cogs, staff, opex, ebitda, financial, nonop, pretax, taxes, net, fund, distributable: net - fund }
}

export function buildStatement(input: StatementInput): Statement {
  const { salesByLine, impoconsumo, accruedByLine, paidByLine, manualItems, nonOperatingItems } = input

  const accrued = emptyLineAmounts()
  const paid = emptyLineAmounts()

  // La venta es la misma en las dos columnas: se reconoce cuando se vende.
  for (const key of REVENUE_KEYS) {
    accrued[key] = salesByLine[key] ?? 0
    paid[key] = salesByLine[key] ?? 0
  }

  for (const l of LINES) {
    if (REVENUE_KEYS.includes(l.key)) continue
    accrued[l.key] += accruedByLine[l.key] ?? 0
    paid[l.key] += paidByLine[l.key] ?? 0
  }

  // Provision de impoconsumo = lo que el POS facturo como impuesto en el mes,
  // tal como lo define la plantilla. Sin POS queda en $0 y el Excel lo dice en
  // la nota al pie. Va despues del loop porque `aggregateAccrued` lo deja en 0.
  accrued.tax_impo = impoconsumo ?? 0

  for (const item of manualItems) {
    accrued[item.line] += item.accrued
    paid[item.line] += item.paid
  }

  for (const item of nonOperatingItems) {
    accrued[item.line] += item.accrued
    paid[item.line] += item.paid
  }

  return { accrued: buildSide(accrued), paid: buildSide(paid) }
}

/** Suma de los montos `accrued` de una lista de items manuales. */
export const sumAccrued = (items: ManualItem[]): number =>
  items.reduce((a, i) => a + i.accrued, 0)

/** Suma de los montos `paid` de una lista de items manuales. */
export const sumPaid = (items: ManualItem[]): number =>
  items.reduce((a, i) => a + i.paid, 0)
