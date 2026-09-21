// Deteccion de gasto que probablemente falta cargar.
//
// Gastos recurrentes que este mes desaparecieron o se desplomaron frente al mes
// pasado: casi siempre es una factura que falta, no un ahorro real. Sin esto el
// margen sale inflado en silencio — que es exactamente el modo de fallo que este
// informe no puede permitirse.

import { LINE_LABEL } from './lines.ts'
import type { LineAmounts, ManualItem } from './types.ts'

export const WATCHED_LINES = [
  'op_rent', 'op_utilities', 'staff_social', 'staff_payroll',
  'cogs_food', 'cogs_packaging', 'op_accounting',
]

export interface MissingLine {
  key: string
  label: string | undefined
  amount: number
  prevAmount: number
}

export interface MissingInput {
  /** Gasto causado por linea del mes, ya agregado (sin los ajustes manuales). */
  curByLine: LineAmounts
  prevByLine: LineAmounts
  curManual: ManualItem[]
  prevManual: ManualItem[]
}

/**
 * Los ajustes manuales cuentan: una linea que solo vive en los ajustes — un
 * arriendo provisionado, una parte de honorarios reasignada — esta en el P&L y
 * en el Excel, y sin sumarla aqui el informe grita "falta una factura" sobre un
 * gasto que si esta cargado.
 */
function withManual(byLine: LineAmounts, manual: ManualItem[]): LineAmounts {
  const acc: LineAmounts = { ...byLine }
  for (const m of manual ?? []) if (m.line) acc[m.line] = (acc[m.line] ?? 0) + m.accrued
  return acc
}

export function missingLines(input: MissingInput): MissingLine[] {
  // Se compara sobre lo causado: es lo que dice si el gasto del mes esta
  // completo. `tax_impo` no se consulta aqui, asi que da igual que los mapas
  // vengan sin el (ver aggregateAccrued).
  const cur = withManual(input.curByLine, input.curManual)
  const prev = withManual(input.prevByLine, input.prevManual)
  const out: MissingLine[] = []

  for (const k of WATCHED_LINES) {
    const now = cur[k] ?? 0
    const before = prev[k] ?? 0
    if (before <= 0) continue
    // Cayo a la mitad o menos, y la plata en juego no es trivial.
    if (now <= before * 0.5 && before - now >= 500_000) {
      out.push({ key: k, label: LINE_LABEL.get(k), amount: now, prevAmount: before })
    }
  }

  // Faltantes que hay que gritar aunque el mes pasado tampoco los tuvieran — el
  // caso de una sede recien abierta, donde comparar contra el mes anterior no
  // sirve. Un restaurante siempre paga arriendo, y si hay nomina hay planilla.
  const adjusted = (key: string): boolean =>
    input.curManual?.some((m) => m.line === key && m.accrued > 0) ?? false
  const forceCheck = [
    { key: 'op_rent', when: true },
    { key: 'staff_social', when: (cur.staff_payroll ?? 0) > 0 },
  ]
  for (const { key, when } of forceCheck) {
    if (!when || (cur[key] ?? 0) > 0 || adjusted(key) || out.some((o) => o.key === key)) continue
    out.push({ key, label: LINE_LABEL.get(key), amount: 0, prevAmount: prev[key] ?? 0 })
  }
  return out
}
