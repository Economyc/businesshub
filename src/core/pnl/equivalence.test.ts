// Equivalencia entre las implementaciones ORIGINALES (las que vivian dentro de
// scripts/informe-mensual-negocios.mjs antes de extraer el motor) y las de
// src/core/pnl/.
//
// Existe porque el generador de informes nunca estuvo en git: no hay version
// anterior contra la cual diffear los .xlsx, y los datos de Ecore cambian entre
// corridas, asi que comparar dos Excel generados en momentos distintos no aisla
// el refactor. Esto si lo aisla: mismas entradas, las dos implementaciones.
//
// Las copias de abajo son textuales. Si alguien cambia el motor a proposito,
// este test falla y hay que actualizarlas conscientemente.

import { describe, it, expect } from 'vitest'
import { LINES, linesOf } from './lines.ts'
import { monthRange, prevMonthOf, monthsBetween, MONTH_NAMES } from './month.ts'
import { aggregateAccrued, aggregatePaid, buildStatement } from './statement.ts'
import { buildBridge } from './bridge.ts'
import { spreadDeferrals } from './deferrals.ts'
import { missingLines } from './missing.ts'
import type { LineSection } from './lines.ts'
import type { Deferral, ManualItem } from './types.ts'

// PRNG determinista, para que una falla sea siempre reproducible.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const EXPENSE_KEYS = LINES.filter((l) => !l.key.startsWith('rev_')).map((l) => l.key)

interface Row {
  line: string | null
  amount: number
  withheld?: number
  excluded?: string
  inAccrual?: boolean
  inCash?: boolean
}

interface Item {
  line: string
  concept: string
  accrued: number
  paid: number
}

interface Expenses {
  accrued: Row[]
  paid: Row[]
  all: Row[]
  manual: Item[]
}

function makeCase(seed: number) {
  const r = mulberry32(seed)
  const pick = <T>(a: T[]): T => a[Math.floor(r() * a.length)]
  // Montos con cola negativa: los contra-asientos de reparto existen de verdad.
  const money = (): number => Math.round((r() - 0.15) * 4_000_000)

  const accrued: Row[] = []
  const paid: Row[] = []
  const all: Row[] = []
  for (let i = 0; i < 40; i++) {
    const line = r() < 0.08 ? null : pick(EXPENSE_KEYS)
    const excluded = r() < 0.15
      ? pick(['abono a capital', 'entre locales', 'propina', 'socios / préstamo'])
      : undefined
    const row: Row = {
      line,
      amount: money(),
      withheld: r() < 0.3 ? Math.round(r() * 100_000) : 0,
      excluded,
      inAccrual: r() < 0.7,
      inCash: r() < 0.6,
    }
    all.push(row)
    if (row.inAccrual && !excluded) accrued.push(row)
    if (row.inCash && !excluded) paid.push(row)
  }

  const manual: Item[] = Array.from({ length: 6 }, () => ({
    line: pick(EXPENSE_KEYS),
    concept: 'ajuste',
    accrued: r() < 0.25 ? 0 : money(),
    paid: r() < 0.25 ? 0 : money(),
  }))

  const nonOp: Item[] = r() < 0.5
    ? [{ line: 'nonop_asset_sale', concept: 'venta', accrued: money(), paid: money() }]
    : []

  const sales = {
    byLine: {
      rev_food: Math.abs(money()) * 10,
      rev_drinks: Math.abs(money()),
      rev_delivery: Math.abs(money()),
      rev_other: 0,
    } as Record<string, number>,
    impoconsumo: Math.abs(money()),
  }

  const expenses: Expenses = { accrued, paid, all, manual }
  return { sales, expenses, nonOp, rnd: r }
}

// ───────── Implementaciones ORIGINALES (copia textual del script) ─────────

function buildStatementOld(
  sales: { byLine: Record<string, number>; impoconsumo: number },
  expenses: Expenses,
  nonOp: Item[],
) {
  const accrued: Record<string, number> = Object.fromEntries(LINES.map((l) => [l.key, 0]))
  const paid: Record<string, number> = Object.fromEntries(LINES.map((l) => [l.key, 0]))

  for (const key of ['rev_food', 'rev_drinks', 'rev_delivery', 'rev_other']) {
    accrued[key] = sales.byLine[key] ?? 0
    paid[key] = sales.byLine[key] ?? 0
  }
  for (const r of expenses.accrued) {
    if (!r.line) continue
    if (r.line === 'tax_impo') continue
    accrued[r.line] += r.amount
  }
  accrued.tax_impo = sales.impoconsumo ?? 0
  for (const r of expenses.paid) if (r.line) paid[r.line] += r.amount - (r.withheld ?? 0)
  for (const item of expenses.manual) {
    accrued[item.line] += item.accrued
    paid[item.line] += item.paid
  }
  for (const item of nonOp) {
    accrued[item.line] += item.accrued
    paid[item.line] += item.paid
  }

  const sum = (obj: Record<string, number>, section: LineSection) =>
    linesOf(section).reduce((s, l) => s + obj[l.key], 0)
  const build = (obj: Record<string, number>) => {
    const revenue = sum(obj, 'revenue')
    const cogs = sum(obj, 'cogs')
    const staff = sum(obj, 'staff')
    const opex = sum(obj, 'opex')
    const ebitda = revenue - cogs - staff - opex
    const financial = obj.fin_expense - obj.fin_income
    const nonop = sum(obj, 'nonop')
    const pretax = ebitda - financial + nonop
    const taxes = sum(obj, 'taxes')
    const net = pretax - taxes
    const fund = net > 0 ? net * 0.05 : 0
    return {
      values: obj, revenue, cogs, staff, opex, ebitda, financial,
      nonop, pretax, taxes, net, fund, distributable: net - fund,
    }
  }
  return { accrued: build(accrued), paid: build(paid) }
}

const EXCLUIDOS_QUE_SON_CAJA = new Set([
  'abono a capital', 'socios / prestamo', 'socios / préstamo', 'entre locales',
])

type OldStatement = ReturnType<typeof buildStatementOld>

function puenteCajaOld(
  monthLabel: string,
  expenses: Expenses,
  st: OldStatement,
  noRecibidos: { concept: string; amount: number }[],
) {
  const suma = (rows: Row[], f: (r: Row) => unknown) =>
    rows.reduce((a, r) => a + (f(r) ? r.amount : 0), 0)
  const gastoReal = (r: Row) => !r.excluded && r.line

  const soloCausado = suma(expenses.all, (r) => gastoReal(r) && r.inAccrual && !r.inCash)
    + (expenses.manual ?? []).reduce((a, m) => a + (m.accrued && !m.paid ? m.accrued : 0), 0)
  const soloPagado = suma(expenses.all, (r) => gastoReal(r) && !r.inAccrual && r.inCash)
    + (expenses.manual ?? []).reduce((a, m) => a + (m.paid && !m.accrued ? m.paid : 0), 0)
  const impoDif = (st.paid.values.tax_impo ?? 0) - (st.accrued.values.tax_impo ?? 0)
  const fueraDelPnl = suma(
    expenses.all,
    (r) => r.excluded && r.inCash && EXCLUIDOS_QUE_SON_CAJA.has(r.excluded),
  )

  const filas: { label: string; valor: number; tipo?: string }[] = [
    { label: 'Utilidad neta del mes', valor: st.accrued.net, tipo: 'base' },
    { label: `Costos de ${monthLabel} que aún no se han pagado`, valor: soloCausado },
    { label: `Facturas de meses anteriores pagadas en ${monthLabel}`, valor: -soloPagado },
  ]
  if (Math.abs(impoDif) > 0.5) {
    filas.push({
      label: impoDif > 0
        ? 'Giro a la DIAN (liquida el bimestre, no el mes)'
        : 'Impoconsumo provisionado que aún no se ha girado',
      valor: -impoDif,
    })
  }
  if (fueraDelPnl > 0.5) {
    filas.push({ label: 'Abonos a capital y movimientos que no son gasto', valor: -fueraDelPnl })
  }
  for (const i of noRecibidos) filas.push({ label: i.concept, valor: -i.amount })
  const caja = filas.reduce((a, f) => a + f.valor, 0)
  filas.push({ label: 'Caja que dejó el mes', valor: caja, tipo: 'total' })
  return { filas, caja, porPagar: soloCausado }
}

function spreadDeferralsOld(list: Deferral[], ym: string) {
  const out: ManualItem[] = []
  for (const d of list) {
    if (!d.from || !d.months) continue
    const idx = monthsBetween(d.from, ym)
    const devenga = idx >= 0 && idx < d.months
    const accrued = devenga ? d.total / d.months : 0
    const paid = d.paidOn === ym ? d.total : 0
    if (!accrued && !paid) continue
    out.push({
      line: d.line,
      concept: devenga
        ? `${d.concept} — mes ${idx + 1} de ${d.months}`
        : `${d.concept} — pago anticipado (devenga desde ${d.from})`,
      accrued,
      paid,
      source: d.source,
    })
  }
  return out
}

const WATCHED_OLD = [
  'op_rent', 'op_utilities', 'staff_social', 'staff_payroll',
  'cogs_food', 'cogs_packaging', 'op_accounting',
]

function missingLinesOld(expenses: Expenses, prevExpenses: Expenses) {
  const total = (rows: Row[]) => {
    const acc: Record<string, number> = {}
    for (const r of rows) if (r.line) acc[r.line] = (acc[r.line] ?? 0) + r.amount
    return acc
  }
  const withManual = (rows: Row[], manual: Item[]) => {
    const acc = total(rows)
    for (const m of manual ?? []) if (m.line) acc[m.line] = (acc[m.line] ?? 0) + m.accrued
    return acc
  }
  const cur = withManual(expenses.accrued, expenses.manual)
  const prev = withManual(prevExpenses.accrued, prevExpenses.manual)
  const out: { key: string; amount: number; prevAmount: number }[] = []

  for (const k of WATCHED_OLD) {
    const now = cur[k] ?? 0
    const before = prev[k] ?? 0
    if (before <= 0) continue
    if (now <= before * 0.5 && before - now >= 500_000) {
      out.push({ key: k, amount: now, prevAmount: before })
    }
  }
  const adjusted = (key: string) => expenses.manual?.some((m) => m.line === key && m.accrued > 0)
  const forceCheck = [
    { key: 'op_rent', when: true },
    { key: 'staff_social', when: (cur.staff_payroll ?? 0) > 0 },
  ]
  for (const { key, when } of forceCheck) {
    if (!when || cur[key] > 0 || adjusted(key) || out.some((o) => o.key === key)) continue
    out.push({ key, amount: 0, prevAmount: prev[key] ?? 0 })
  }
  return out
}

// ───────── Las pruebas ─────────

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)

describe('el motor extraido calcula lo mismo que el script original', () => {
  it('buildStatement: identico en 200 casos', () => {
    for (const seed of SEEDS) {
      const { sales, expenses, nonOp } = makeCase(seed)
      const oldSt = buildStatementOld(sales, expenses, nonOp)
      const newSt = buildStatement({
        salesByLine: sales.byLine,
        impoconsumo: sales.impoconsumo,
        accruedByLine: aggregateAccrued(expenses.accrued),
        paidByLine: aggregatePaid(expenses.paid),
        manualItems: expenses.manual,
        nonOperatingItems: nonOp,
      })
      expect(newSt, `semilla ${seed}`).toEqual(oldSt)
    }
  })

  it('puenteCaja → buildBridge: identico en 200 casos', () => {
    for (const seed of SEEDS) {
      const { sales, expenses, nonOp, rnd } = makeCase(seed)
      const st = buildStatementOld(sales, expenses, nonOp)
      const noRecibidos = rnd() < 0.4
        ? [{ concept: 'Rappi en transito', amount: Math.round(rnd() * 9_000_000) }]
        : []
      const label = 'Agosto 2026'
      const oldB = puenteCajaOld(label, expenses, st, noRecibidos)

      const suma = (rows: Row[], f: (r: Row) => unknown) =>
        rows.reduce((a, r) => a + (f(r) ? r.amount : 0), 0)
      const gastoReal = (r: Row) => !r.excluded && r.line
      const newB = buildBridge({
        monthLabel: label,
        net: st.accrued.net,
        soloCausadoEcore: suma(expenses.all, (r) => gastoReal(r) && r.inAccrual && !r.inCash),
        soloPagadoEcore: suma(expenses.all, (r) => gastoReal(r) && !r.inAccrual && r.inCash),
        fueraDelPnl: suma(
          expenses.all,
          (r) => r.excluded && r.inCash && EXCLUIDOS_QUE_SON_CAJA.has(r.excluded),
        ),
        impoAccrued: st.accrued.values.tax_impo ?? 0,
        impoPaid: st.paid.values.tax_impo ?? 0,
        manualItems: expenses.manual,
        incomeNotReceived: noRecibidos,
      })
      expect(newB, `semilla ${seed}`).toEqual(oldB)
    }
  })

  it('missingLines: identico en 200 casos', () => {
    for (const seed of SEEDS) {
      const a = makeCase(seed)
      const b = makeCase(seed + 5000)
      const oldM = missingLinesOld(a.expenses, b.expenses)
      const newM = missingLines({
        curByLine: aggregateAccrued(a.expenses.accrued),
        prevByLine: aggregateAccrued(b.expenses.accrued),
        curManual: a.expenses.manual,
        prevManual: b.expenses.manual,
      }).map((m) => ({ key: m.key, amount: m.amount, prevAmount: m.prevAmount }))
      expect(newM, `semilla ${seed}`).toEqual(oldM)
    }
  })

  it('spreadDeferrals: identico mes a mes, incluido el diferido de 60 meses', () => {
    const list: Deferral[] = [
      { concept: 'Siigo licencia anual', line: 'op_software', total: 3_600_000, from: '2026-03', months: 12, paidOn: '2026-03', source: 'Factura Siigo' },
      { concept: 'Poliza', line: 'op_insurance', total: 1_200_000, from: '2026-01', months: 6, paidOn: '2025-12', source: 'Ecore' },
      { concept: 'Sin from', line: 'op_other', total: 500_000, from: '', months: 3, paidOn: null, source: 'x' },
      { concept: 'Largo', line: 'op_other', total: 6_000_000, from: '2022-01', months: 60, paidOn: '2022-01', source: 'y' },
    ]
    for (let y = 2021; y <= 2027; y++) {
      for (let m = 1; m <= 12; m++) {
        const ym = `${y}-${String(m).padStart(2, '0')}`
        expect(spreadDeferrals(list, ym), ym).toEqual(spreadDeferralsOld(list, ym))
      }
    }
  })

  it('monthRange / prevMonthOf / monthsBetween: sin cambios de comportamiento', () => {
    const MONTH_NAMES_OLD = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ]
    expect(MONTH_NAMES).toEqual(MONTH_NAMES_OLD)

    const monthRangeOld = (ym: string) => {
      const [y, m] = ym.split('-').map(Number)
      const start = new Date(y, m - 1, 1, 0, 0, 0)
      const end = new Date(y, m, 0, 23, 59, 59, 999)
      const p = (n: number) => String(n).padStart(2, '0')
      return {
        ym, year: y, monthIdx: m - 1, start, end,
        fromStr: `${y}-${p(m)}-01`,
        toStr: `${y}-${p(m)}-${p(end.getDate())}`,
        label: `${MONTH_NAMES_OLD[m - 1]} ${y}`,
        days: end.getDate(),
      }
    }
    const prevOld = (ym: string) => {
      const [y, m] = ym.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    for (let y = 2024; y <= 2027; y++) {
      for (let m = 1; m <= 12; m++) {
        const ym = `${y}-${String(m).padStart(2, '0')}`
        expect(monthRange(ym), ym).toEqual(monthRangeOld(ym))
        expect(prevMonthOf(ym), ym).toBe(prevOld(ym))
      }
    }
    expect(monthsBetween('2026-03', '2026-07')).toBe(4)
    expect(monthsBetween('2025-11', '2026-02')).toBe(3)
    expect(monthsBetween('2026-07', '2026-03')).toBe(-4)
  })
})
