// Aritmetica de meses del cierre. Todo opera sobre `ym` = 'YYYY-MM'.
// Movido desde scripts/informe-mensual-negocios.mjs, donde estaba atrapado
// junto al codigo de ExcelJS.

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export interface MonthRange {
  ym: string
  year: number
  monthIdx: number
  start: Date
  end: Date
  /** 'YYYY-MM-01' — el POS guarda la fecha como string, no como Timestamp. */
  fromStr: string
  /** 'YYYY-MM-DD' del ultimo dia del mes. */
  toStr: string
  label: string
  days: number
}

const pad = (n: number): string => String(n).padStart(2, '0')

export function monthRange(ym: string): MonthRange {
  const [y, m] = ym.split('-').map(Number)
  const start = new Date(y, m - 1, 1, 0, 0, 0)
  const end = new Date(y, m, 0, 23, 59, 59, 999)
  return {
    ym,
    year: y,
    monthIdx: m - 1,
    start,
    end,
    fromStr: `${y}-${pad(m)}-01`,
    toStr: `${y}-${pad(m)}-${pad(end.getDate())}`,
    label: `${MONTH_NAMES[m - 1]} ${y}`,
    days: end.getDate(),
  }
}

export const prevMonthOf = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Meses transcurridos de `from` a `to` ("2026-03" → "2026-07" = 4). */
export const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/** 'YYYY-MM' de un Date, en hora local (no UTC: el cierre es en Bogota). */
export const ymOf = (d: Date | null): string | null =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : null
