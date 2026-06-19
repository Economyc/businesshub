#!/usr/bin/env node
// Informe semanal de Suministros de Blue Manila en HTML.
// Cuánto se gastó (caja: status==='paid', ubicado por paidDate) en la categoría
// "Suministros" en cada semana lunes-domingo del mes, recortado al día de hoy.
//
// Lee companies/{companyId}/transactions desde Firestore (ADC, read-only) y deja
// el HTML en ~/Downloads/Suministros-Semanal-Blue-Manila/.
//
// Uso:
//   node scripts/suministros-semanal-blue-manila.mjs                       # junio 2026, Blue Manila
//   node scripts/suministros-semanal-blue-manila.mjs --month 7 --year 2026 # otro mes (1-12)
//   node scripts/suministros-semanal-blue-manila.mjs --company <id>
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))

const PROJECT_ID = 'empresas-bf'
const DEFAULT_COMPANY = '36dNFE9OH1ISyGXZ5GKe' // Blue Smash Brgr · Manila

// ───────── CLI ─────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) {
      const key = cur.slice(2)
      const next = arr[i + 1]
      acc.push([key, next && !next.startsWith('--') ? next : 'true'])
    }
    return acc
  }, []),
)
const COMPANY_ID = args.company || DEFAULT_COMPANY
const now = new Date()
const YEAR = args.year ? Number(args.year) : now.getFullYear()
const MONTH = args.month ? Number(args.month) - 1 : now.getMonth() // 0-indexed

// ───────── Helpers ─────────
const normalize = (s) =>
  (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const baseCategory = (cat) => normalize((cat ?? '').toString().split(' > ')[0])
const NO_SUB = '(sin subcategoría)'
const subCategory = (cat) => {
  const parts = (cat ?? '').toString().split(' > ')
  return parts[1] ? parts.slice(1).join(' > ').trim() : NO_SUB
}
// Proveedor real desde payeeRef; fallback al texto antes de " - " en el concepto.
const supplierOf = (t) => {
  const n = t?.payeeRef?.name
  if (n) return n.toString().trim()
  const c = (t.concept || t.description || '').toString()
  const dash = c.split(' - ')[0].trim()
  return dash || '(sin proveedor)'
}
const toDate = (ts) => ts?.toDate?.() ?? (ts instanceof Date ? ts : null)
const COP = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fmtDay = (d) => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`
const fmtFull = (d) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '—'

// Lunes de la semana de d (00:00). Domingo cuenta como fin de la semana previa.
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const back = (x.getDay() + 6) % 7 // lun=0 ... dom=6
  x.setDate(x.getDate() - back)
  return x
}
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// La fecha que ubica el gasto en el tiempo: paidDate (caja), fallback date.
const payDate = (t) => toDate(t.paidDate) ?? toDate(t.date)

// ───────── Init Firestore ─────────
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

async function main() {
  const companyDoc = await db.collection('companies').doc(COMPANY_ID).get()
  if (!companyDoc.exists) {
    console.error(`No existe la company ${COMPANY_ID}`)
    process.exit(1)
  }
  const company = { id: companyDoc.id, ...(companyDoc.data() || {}) }
  console.log(`Proyecto: ${PROJECT_ID}`)
  console.log(`Empresa: ${company.name}${company.location ? ' · ' + company.location : ''} (${company.id})\n`)

  const snap = await db.collection('companies').doc(COMPANY_ID).collection('transactions').get()
  const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // Rango del mes recortado a hoy (si es el mes en curso).
  const monthStart = new Date(YEAR, MONTH, 1)
  const monthEndRaw = new Date(YEAR, MONTH + 1, 0) // último día del mes
  const isCurrentMonth = now.getFullYear() === YEAR && now.getMonth() === MONTH
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const cutoff = isCurrentMonth && today < monthEndRaw ? today : monthEndRaw

  // Filtro: gasto de Suministros, pagado, con paidDate dentro del rango.
  const inRange = (d) => !!d && d >= monthStart && d <= new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate(), 23, 59, 59)
  const sumin = txs.filter(
    (t) =>
      t.type === 'expense' &&
      t.status === 'paid' &&
      baseCategory(t.category) === 'suministros' &&
      inRange(payDate(t)),
  )
  // Nota informativa: pendientes del mes (por fecha de factura) que NO se cuentan.
  const pendingCount = txs.filter(
    (t) =>
      t.type === 'expense' &&
      t.status !== 'paid' &&
      baseCategory(t.category) === 'suministros' &&
      (() => {
        const d = toDate(t.date)
        return !!d && d >= monthStart && d <= monthEndRaw
      })(),
  )
  const pendingTotal = pendingCount.reduce((s, t) => s + (Number(t.amount) || 0), 0)

  // ───────── Construir semanas lun-dom que solapan el rango ─────────
  const weeks = []
  let cursor = mondayOf(monthStart)
  while (cursor <= cutoff) {
    const wStart = cursor
    const wEnd = addDays(cursor, 6)
    weeks.push({ start: wStart, end: wEnd, txs: [], total: 0 })
    cursor = addDays(cursor, 7)
  }
  const weekIndexFor = (d) => {
    const m = mondayOf(d).getTime()
    return weeks.findIndex((w) => w.start.getTime() === m)
  }
  for (const t of sumin) {
    const idx = weekIndexFor(payDate(t))
    if (idx >= 0) {
      weeks[idx].txs.push(t)
      weeks[idx].total += Number(t.amount) || 0
    }
  }

  // Desglose por subcategoría dentro de cada semana + total del mes.
  for (const w of weeks) {
    const map = new Map()
    for (const t of w.txs) {
      const sc = subCategory(t.category)
      if (!map.has(sc)) map.set(sc, { total: 0, txs: [] })
      const e = map.get(sc)
      e.total += Number(t.amount) || 0
      e.txs.push(t)
    }
    w.subs = Array.from(map.entries())
      .map(([name, e]) => ({ name, total: e.total, txs: e.txs }))
      .sort((a, b) => b.total - a.total)
    w.count = w.txs.length
  }
  const monthTotal = sumin.reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const monthSubMap = new Map()
  for (const t of sumin) {
    const sc = subCategory(t.category)
    if (!monthSubMap.has(sc)) monthSubMap.set(sc, { total: 0, txs: [] })
    const e = monthSubMap.get(sc)
    e.total += Number(t.amount) || 0
    e.txs.push(t)
  }
  const monthSubs = Array.from(monthSubMap.entries())
    .map(([name, e]) => ({ name, total: e.total, count: e.txs.length, txs: e.txs }))
    .sort((a, b) => b.total - a.total)

  const maxWeek = Math.max(1, ...weeks.map((w) => w.total))

  // ───────── Consola ─────────
  const periodLabel = `${MESES[MONTH][0].toUpperCase()}${MESES[MONTH].slice(1)} ${YEAR}${isCurrentMonth ? ` (al ${fmtDay(cutoff)})` : ''}`
  console.log(`Suministros — base: fecha de pago (solo pagado) — ${periodLabel}`)
  console.log('─'.repeat(60))
  for (const w of weeks) {
    const partial = isCurrentMonth && w.end >= today
    console.log(
      `  ${fmtDay(w.start)} – ${fmtDay(w.end)}${partial ? ' (parcial)' : ''}`.padEnd(28) +
        `${COP(w.total).padStart(16)}  (${w.count} fact.)`,
    )
  }
  console.log('─'.repeat(60))
  console.log(`  TOTAL DEL MES`.padEnd(28) + `${COP(monthTotal).padStart(16)}  (${sumin.length} fact.)`)
  if (pendingCount.length) {
    console.log(`\n  (nota: ${pendingCount.length} factura(s) pendiente(s) por ${COP(pendingTotal)} — no contadas)`)
  }

  // ───────── HTML ─────────
  const html = buildHtml({ company, periodLabel, weeks, monthTotal, monthSubs, sumin, maxWeek, isCurrentMonth, today, pendingCount, pendingTotal, cutoff })
  const outDir = join(homedir(), 'Downloads', 'Suministros-Semanal-Blue-Manila')
  mkdirSync(outDir, { recursive: true })
  const slug = `${YEAR}-${String(MONTH + 1).padStart(2, '0')}`
  const outPath = join(outDir, `Suministros-Semanal-Blue-Manila_${slug}.html`)
  writeFileSync(outPath, html, 'utf8')
  console.log(`\n✓ HTML: ${outPath}`)
}

// ───────── HTML builder ─────────
const esc = (s) => (s ?? '').toString().replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Desglose por proveedor de un conjunto de transacciones (para "sin subcategoría").
function suppliersBreakdown(txs) {
  const map = new Map()
  for (const t of txs) {
    const s = supplierOf(t)
    if (!map.has(s)) map.set(s, { total: 0, count: 0 })
    const e = map.get(s)
    e.total += Number(t.amount) || 0
    e.count++
  }
  return Array.from(map.entries())
    .map(([name, e]) => ({ name, total: e.total, count: e.count }))
    .sort((a, b) => b.total - a.total)
}

function buildHtml(ctx) {
  const { company, periodLabel, weeks, monthTotal, monthSubs, sumin, maxWeek, isCurrentMonth, today, pendingCount, pendingTotal, cutoff } = ctx
  const COPx = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
  const fmtRange = (w) => `${w.start.getDate()} ${MESES[w.start.getMonth()].slice(0, 3)} – ${w.end.getDate()} ${MESES[w.end.getMonth()].slice(0, 3)}`
  const avg = (w) => (w.count ? w.total / w.count : 0)
  const genDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`

  // Dropdown de proveedores para la fila "(sin subcategoría)".
  const provTable = (txs) => {
    const rows = suppliersBreakdown(txs)
      .map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${COPx(p.total)}</td><td class="num">${p.count}</td></tr>`)
      .join('')
    return `<table class="prov"><thead><tr><th>Proveedor</th><th class="num">Valor</th><th class="num"># Fact.</th></tr></thead><tbody>${rows}</tbody></table>`
  }
  const subNameCell = (s) =>
    s.name === NO_SUB
      ? `<details class="prov-dd"><summary>${esc(s.name)} <span class="hint">ver proveedores</span></summary>${provTable(s.txs)}</details>`
      : esc(s.name)

  const weekRows = weeks
    .map((w) => {
      const partial = isCurrentMonth && w.end >= today
      const pct = maxWeek > 0 ? Math.round((w.total / maxWeek) * 100) : 0
      return `
      <tr${partial ? ' class="partial"' : ''}>
        <td class="rng">${esc(fmtRange(w))}${partial ? ' <span class="badge">en curso</span>' : ''}
          <div class="bar"><span style="width:${pct}%"></span></div>
        </td>
        <td class="num strong">${COPx(w.total)}</td>
        <td class="num">${w.count}</td>
        <td class="num">${COPx(avg(w))}</td>
      </tr>`
    })
    .join('')

  const weekDetail = weeks
    .filter((w) => w.count > 0)
    .map((w) => {
      const partial = isCurrentMonth && w.end >= today
      const subRows = w.subs
        .map(
          (s) => `<tr><td>${subNameCell(s)}</td><td class="num">${COPx(s.total)}</td><td class="num">${Math.round((s.total / w.total) * 100)}%</td></tr>`,
        )
        .join('')
      return `
      <div class="week-card">
        <div class="week-head">
          <span class="week-title">${esc(fmtRange(w))}${partial ? ' <span class="badge">en curso</span>' : ''}</span>
          <span class="week-total">${COPx(w.total)} · ${w.count} fact.</span>
        </div>
        <table class="sub">
          <thead><tr><th>Subcategoría</th><th class="num">Valor</th><th class="num">%</th></tr></thead>
          <tbody>${subRows}</tbody>
        </table>
      </div>`
    })
    .join('')

  const monthSubRows = monthSubs
    .map(
      (s) =>
        `<tr><td>${subNameCell(s)}</td><td class="num">${COPx(s.total)}</td><td class="num">${s.count}</td><td class="num">${monthTotal > 0 ? Math.round((s.total / monthTotal) * 100) : 0}%</td></tr>`,
    )
    .join('')

  const pendingNote = pendingCount.length
    ? `<p class="note">Nota: ${pendingCount.length} factura(s) de Suministros del mes están <strong>pendientes</strong> por ${COPx(pendingTotal)} y no se incluyen (informe por caja pagada).</p>`
    : ''

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Suministros por semana · ${esc(company.name)} ${esc(company.location || '')}</title>
<style>
  :root{
    --bone:#FAF9F6; --paper:#FFFFFF; --graphite:#374151; --muted:#6B7280;
    --line:#E5E7EB; --line-soft:#EFEFEC; --accent:#1ABC9C; --accent-bg:#E8F8F4;
    --strong:#111827;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bone);color:var(--graphite);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    font-size:14px;line-height:1.5;padding:32px 16px}
  .wrap{max-width:820px;margin:0 auto}
  header{margin-bottom:24px}
  h1{font-size:22px;font-weight:600;margin:0 0 4px;color:var(--strong)}
  .sub{color:var(--muted)}
  .meta{color:var(--muted);font-size:13px;margin-top:6px}
  .meta strong{color:var(--graphite)}
  .kpi{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0 8px}
  .kpi .box{background:var(--paper);border:1px solid var(--line);border-radius:12px;
    padding:14px 18px;min-width:160px}
  .kpi .label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
  .kpi .value{font-size:22px;font-weight:600;color:var(--strong);margin-top:2px}
  section{background:var(--paper);border:1px solid var(--line);border-radius:14px;
    padding:18px 20px;margin-top:18px}
  h2{font-size:15px;font-weight:600;margin:0 0 12px;color:var(--strong)}
  table{width:100%;border-collapse:collapse}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);
    text-align:left;font-weight:600;padding:6px 8px;border-bottom:1px solid var(--line)}
  td{padding:9px 8px;border-bottom:1px solid var(--line-soft);vertical-align:middle}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .strong{font-weight:600;color:var(--strong)}
  tr.partial td{background:var(--accent-bg)}
  .total-row td{border-top:2px solid var(--graphite);border-bottom:none;font-weight:700;
    color:var(--strong);font-size:15px;padding-top:12px}
  .rng{min-width:200px}
  .bar{height:6px;background:var(--line);border-radius:999px;margin-top:6px;overflow:hidden}
  .bar span{display:block;height:100%;background:var(--accent);border-radius:999px}
  .badge{display:inline-block;font-size:10px;font-weight:600;color:var(--accent);
    background:var(--accent-bg);border-radius:999px;padding:1px 8px;margin-left:6px;
    text-transform:uppercase;letter-spacing:.04em;vertical-align:middle}
  .week-card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px}
  .week-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .week-title{font-weight:600;color:var(--strong)}
  .week-total{color:var(--muted);font-size:13px}
  table.sub th,table.sub td{padding:5px 8px}
  details.prov-dd summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px}
  details.prov-dd summary::-webkit-details-marker{display:none}
  details.prov-dd summary::before{content:"\\25B8";color:var(--accent);font-size:11px;transition:transform .15s}
  details.prov-dd[open] summary::before{transform:rotate(90deg)}
  .hint{font-size:11px;color:var(--accent);font-weight:500}
  table.prov{margin:8px 0 4px;background:var(--bone);border:1px solid var(--line);border-radius:8px}
  table.prov th,table.prov td{padding:4px 8px;font-size:13px;border-bottom:1px solid var(--line-soft)}
  table.prov tr:last-child td{border-bottom:none}
  .note{color:var(--muted);font-size:13px;margin-top:14px;background:var(--bone);
    border:1px solid var(--line);border-radius:10px;padding:10px 14px}
  footer{color:var(--muted);font-size:12px;margin-top:24px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Suministros por semana</h1>
    <div class="sub">${esc(company.name)}${company.location ? ' · ' + esc(company.location) : ''}</div>
    <div class="meta">Período: <strong>${esc(periodLabel)}</strong> · Semanas lunes a domingo · Base: <strong>fecha de pago</strong> (solo pagado)</div>
  </header>

  <div class="kpi">
    <div class="box"><div class="label">Total del mes</div><div class="value">${COPx(monthTotal)}</div></div>
    <div class="box"><div class="label">Facturas</div><div class="value">${sumin.length}</div></div>
    <div class="box"><div class="label">Promedio / factura</div><div class="value">${COPx(sumin.length ? monthTotal / sumin.length : 0)}</div></div>
  </div>

  <section>
    <h2>Resumen semanal</h2>
    <table>
      <thead><tr><th>Semana</th><th class="num">Total</th><th class="num"># Fact.</th><th class="num">Prom./fact.</th></tr></thead>
      <tbody>
        ${weekRows}
        <tr class="total-row"><td>Total del mes</td><td class="num">${COPx(monthTotal)}</td><td class="num">${sumin.length}</td><td class="num">${COPx(sumin.length ? monthTotal / sumin.length : 0)}</td></tr>
      </tbody>
    </table>
    ${pendingNote}
  </section>

  <section>
    <h2>Desglose por subcategoría (mes)</h2>
    <table>
      <thead><tr><th>Subcategoría</th><th class="num">Valor</th><th class="num"># Fact.</th><th class="num">% del mes</th></tr></thead>
      <tbody>${monthSubRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Detalle por semana</h2>
    ${weekDetail || '<p class="sub">Sin movimientos en el período.</p>'}
  </section>

  <footer>Generado por BusinessHub · ${esc(genDate)}</footer>
</div>
</body>
</html>`
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  if (err.code === 16 || /UNAUTHENTICATED/i.test(err.message || '')) {
    console.error('\nAutenticación fallida. Corre: gcloud auth application-default login')
  }
  console.error(err.stack)
  process.exit(1)
})
