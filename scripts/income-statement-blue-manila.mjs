#!/usr/bin/env node
// Genera el Estado de Resultados (P&L) de Blue Manila en Excel + PDF con logo,
// valores y porcentajes, y lo deja en ~/Downloads/Estado-Resultados-Blue-Manila/.
//
// Lee companies/{companyId}/transactions desde Firestore (ADC, read-only) y
// replica EXACTAMENTE la lógica de src/modules/finance/hooks.ts (useIncomeStatement):
//   - Ingresos por fecha de emisión (date).
//   - Gastos solo status==='paid', ubicados por recognitionDate = accrualDate ?? paidDate ?? date.
//   - Costo de Ventas = categorías suministros/insumos/costo de ventas (la "materia prima").
//   - Otros ingresos/gastos = otros/propinas (+ impuestos/seguros en gastos).
//
// Uso:
//   node scripts/income-statement-blue-manila.mjs                         # todo el histórico
//   node scripts/income-statement-blue-manila.mjs --from 2026-01-01 --to 2026-06-30
//   node scripts/income-statement-blue-manila.mjs --company <id>
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
const ExcelJS = require(join(__dirname, '../functions/node_modules/exceljs'))
const { jsPDF } = require(join(__dirname, '../node_modules/jspdf'))

const PROJECT_ID = 'empresas-bf'

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
const forcedCompany = args.company || null
const fromArg = args.from || null // YYYY-MM-DD
const toArg = args.to || null

// ───────── Helpers de clasificación (mirror de hooks.ts) ─────────
const normalize = (s) =>
  (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const COST_OF_SALES_CATS = ['suministros', 'insumos', 'costo de ventas']
const OTHER_INCOME_CATS = ['otros', 'propinas']
const OTHER_EXPENSE_CATS = ['impuestos', 'seguros', 'otros', 'propinas']

// Reclasificaciones acordadas con el usuario (override por categoría exacta normalizada),
// porque están categorizadas en la app de forma que no refleja un P&L correcto.
// 1) Compras de comida/empaque que estaban en Gastos Operacionales → Costo de Ventas.
const FORCE_COGS = new Set([
  'empaques', 'compras', 'comida', 'carnes y empaques', 'alimentos',
  'compras de mercancias', 'supermercado', 'alimentos y bebidas',
])
// 2) Movimientos de socios / préstamos: financiación-patrimonio, NO van en el P&L.
//    Nota: el ROI se trata como gasto operacional por decisión del negocio (asegurar
//    el retorno a los socios como parte de la operación), por eso NO se excluye.
const FORCE_EXCLUDE = new Set(['socio', 'prestamo'])

// Ajustes manuales: movimientos que NO están cargados en Firestore pero el usuario
// pide reflejar en el informe. Se inyectan como transacciones sintéticas y fluyen
// por la misma lógica de clasificación/reconocimiento.
const MANUAL_ADJUSTMENTS = [
  {
    type: 'expense',
    category: 'Impuestos',
    concept: 'Retefuente — ajuste manual (no estaba cargada en el sistema)',
    amount: 12683000,
    status: 'paid',
    date: new Date('2026-05-31T12:00:00'),
    _manual: true,
  },
  {
    type: 'expense',
    category: 'Nómina > Salarios',
    concept: 'Jose Roberto — salario mayo pagado en junio (no estaba en el sistema)',
    amount: 2895000,
    status: 'paid',
    date: new Date('2026-05-31T12:00:00'),
    _manual: true,
  },
]

// Reclasificación de transacciones puntuales mal categorizadas (por id de Firestore).
const CATEGORY_RENAMES = {
  // "Jhon Electrico - Compra" $1.700.000: estaba en Servicios Públicos pero es una reparación.
  f3A6XLFgrekjXDumygmd: 'Arreglos',
}

function normalizeCat(category) {
  return (category ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(' > ')[0]
    .trim()
}
function classifyExpense(category) {
  const norm = normalizeCat(category)
  if (COST_OF_SALES_CATS.some((c) => norm.includes(c))) return 'cost_of_sales'
  if (OTHER_EXPENSE_CATS.some((c) => norm === c)) return 'other_expense'
  return 'operating'
}
function classifyIncome(category) {
  const norm = normalizeCat(category)
  if (OTHER_INCOME_CATS.some((c) => norm === c)) return 'other_income'
  return 'revenue'
}
const toDate = (ts) => ts?.toDate?.() ?? (ts instanceof Date ? ts : null)
const isQuincenal = (cat) => {
  const n = normalizeCat(cat)
  return n.includes('nomina') || n.includes('propina')
}
function recognitionDate(t) {
  if (t.accrualDate) return toDate(t.accrualDate)
  // Nómina y distribución de propinas sin accrualDate: convención quincenal
  // colombiana. Si se pagó en los primeros 10 días de un mes, devenga la 2da
  // quincena del mes ANTERIOR (ej.: la Q2 de mayo se paga el 1-3 de junio pero
  // es gasto de mayo). Aplica igual a "Propinas distribuidas - Q2".
  if (t.type === 'expense' && isQuincenal(t.category)) {
    const paid = toDate(t.paidDate) ?? toDate(t.date)
    if (paid && paid.getDate() <= 10) return new Date(paid.getFullYear(), paid.getMonth() - 1, 25)
    return paid
  }
  return toDate(t.paidDate) ?? toDate(t.date)
}

// ───────── Formato ─────────
const COP = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const fmtPct = (n, base) => (base > 0 ? ((n / base) * 100).toFixed(1) + '%' : '—')
const fmtDate = (d) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '—'

// ───────── Init Firestore ─────────
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

async function findBlueManila() {
  if (forcedCompany) {
    const doc = await db.collection('companies').doc(forcedCompany).get()
    return { id: doc.id, ...(doc.data() || {}) }
  }
  const snap = await db.collection('companies').get()
  const candidates = []
  for (const d of snap.docs) {
    const data = d.data()
    if (normalize(data.name).includes('blue')) candidates.push({ id: d.id, ...data })
  }
  console.log('Companies "Blue" encontradas:')
  for (const c of candidates) {
    console.log(`  - id=${c.id} name="${c.name}" location="${c.location ?? ''}" logo=${c.logo ? 'sí' : 'no'}`)
  }
  const manila = candidates.find(
    (c) => normalize(c.location).includes('manila') || normalize(c.name).includes('manila'),
  )
  return manila || candidates[0] || null
}

// ───────── Sección del P&L ─────────
function buildSection(label, txs) {
  const map = new Map()
  for (const t of txs) {
    const cat = t.category || 'Sin categoría'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(t)
  }
  const categories = Array.from(map.entries())
    .map(([category, transactions]) => ({
      category,
      total: transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      count: transactions.length,
    }))
    .sort((a, b) => b.total - a.total)
  return { label, categories, total: txs.reduce((s, t) => s + (Number(t.amount) || 0), 0) }
}

function computeStatement(txs, startDate, endDate) {
  const inRange = (d) => !!d && d >= startDate && d <= endDate
  const incomeTxs = txs.filter((t) => t.type === 'income' && inRange(toDate(t.date)))
  // Gastos pagados en el rango, excluyendo retiros de socios / préstamos (no son P&L).
  const expenseTxs = txs.filter(
    (t) =>
      t.type === 'expense' &&
      t.status === 'paid' &&
      inRange(recognitionDate(t)) &&
      !FORCE_EXCLUDE.has(normalizeCat(t.category)),
  )

  const revenueTxs = [], otherIncomeTxs = []
  for (const t of incomeTxs) {
    if (classifyIncome(t.category) === 'other_income') otherIncomeTxs.push(t)
    else revenueTxs.push(t)
  }
  const costOfSalesTxs = [], operatingTxs = [], otherExpenseTxs = []
  for (const t of expenseTxs) {
    const ncat = normalizeCat(t.category)
    const cls = FORCE_COGS.has(ncat) ? 'cost_of_sales' : classifyExpense(t.category)
    if (cls === 'cost_of_sales') costOfSalesTxs.push(t)
    else if (cls === 'other_expense') otherExpenseTxs.push(t)
    else operatingTxs.push(t)
  }

  const revenue = buildSection('Ingresos Operacionales', revenueTxs)
  const costOfSales = buildSection('Costo de Ventas', costOfSalesTxs)
  const grossProfit = revenue.total - costOfSales.total
  const operatingExpenses = buildSection('Gastos Operacionales', operatingTxs)
  const operatingProfit = grossProfit - operatingExpenses.total
  const otherIncome = buildSection('Otros Ingresos', otherIncomeTxs)
  const otherExpenses = buildSection('Otros Gastos', otherExpenseTxs)
  const netProfit = operatingProfit + otherIncome.total - otherExpenses.total

  const base = revenue.total
  return {
    revenue, costOfSales, grossProfit,
    grossMargin: base > 0 ? (grossProfit / base) * 100 : 0,
    operatingExpenses, operatingProfit,
    operatingMargin: base > 0 ? (operatingProfit / base) * 100 : 0,
    otherIncome, otherExpenses, netProfit,
    netMargin: base > 0 ? (netProfit / base) * 100 : 0,
    transactionCount: incomeTxs.length + expenseTxs.length,
    base,
  }
}

// ───────── Logo: descargar y medir ─────────
function pngSize(buf) {
  // PNG: ancho/alto en big-endian a partir del byte 16.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  return null
}
function jpgSize(buf) {
  // Escanea marcadores SOF para sacar dimensiones.
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue }
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    const len = buf.readUInt16BE(i + 2)
    i += 2 + len
  }
  return null
}
async function loadLogo(company) {
  const url = company.logo
  if (!url) return null
  try {
    let buffer, contentType
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      contentType = res.headers.get('content-type') || ''
      buffer = Buffer.from(await res.arrayBuffer())
    } else {
      // Path de Storage (logos/{companyId}/file). Probar buckets conocidos.
      const path = url.replace(/^gs:\/\/[^/]+\//, '')
      let lastErr
      for (const bk of [`${PROJECT_ID}.firebasestorage.app`, `${PROJECT_ID}.appspot.com`]) {
        try {
          const [data] = await admin.storage().bucket(bk).file(path).download()
          buffer = data
          break
        } catch (e) { lastErr = e }
      }
      if (!buffer) throw lastErr || new Error('no bucket')
    }
    const isPng = (contentType && contentType.includes('png')) || (buffer[0] === 0x89 && buffer[1] === 0x50)
    const ext = isPng ? 'png' : 'jpeg'
    const fmt = isPng ? 'PNG' : 'JPEG'
    const size = isPng ? pngSize(buffer) : jpgSize(buffer)
    const ratio = size && size.h > 0 ? size.w / size.h : 2.5
    return { buffer, ext, fmt, ratio, dataUrl: `data:image/${ext};base64,${buffer.toString('base64')}` }
  } catch (e) {
    console.warn(`⚠ No se pudo cargar el logo (${e.message}). Se usará encabezado de texto.`)
    return null
  }
}

// ───────── Filas del reporte (compartidas por Excel y PDF) ─────────
function buildRows(st) {
  const base = st.base
  const rows = []
  const push = (label, value, kind, indent = 0) =>
    rows.push({ label, value, pct: value == null ? null : fmtPct(value, base), kind, indent })

  // Ingresos
  push('INGRESOS OPERACIONALES', st.revenue.total, 'section')
  for (const c of st.revenue.categories) push(c.category, c.total, 'cat', 1)
  // Costo de ventas
  push('COSTO DE VENTAS (materia prima)', st.costOfSales.total, 'section')
  for (const c of st.costOfSales.categories) push(c.category, c.total, 'cat', 1)
  push('= UTILIDAD BRUTA', st.grossProfit, 'subtotal')
  // Gastos operacionales
  push('GASTOS OPERACIONALES', st.operatingExpenses.total, 'section')
  for (const c of st.operatingExpenses.categories) push(c.category, c.total, 'cat', 1)
  push('= UTILIDAD OPERACIONAL', st.operatingProfit, 'subtotal')
  // Otros
  if (st.otherIncome.total !== 0 || st.otherIncome.categories.length) {
    push('OTROS INGRESOS', st.otherIncome.total, 'section')
    for (const c of st.otherIncome.categories) push(c.category, c.total, 'cat', 1)
  }
  if (st.otherExpenses.total !== 0 || st.otherExpenses.categories.length) {
    push('OTROS GASTOS', st.otherExpenses.total, 'section')
    for (const c of st.otherExpenses.categories) push(c.category, c.total, 'cat', 1)
  }
  push('= UTILIDAD NETA', st.netProfit, 'net')
  return rows
}

// ───────── Excel ─────────
async function buildExcel(st, rows, company, logo, range, outPath) {
  const GRAPHITE = 'FF374151'
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BusinessHub'
  const ws = wb.addWorksheet('Estado de Resultados', {
    views: [{ showGridLines: false }],
  })
  ws.columns = [
    { width: 46 }, // concepto
    { width: 20 }, // valor
    { width: 14 }, // %
  ]

  let r = 1
  // Logo
  if (logo) {
    const imgId = wb.addImage({ buffer: logo.buffer, extension: logo.ext })
    const h = 56
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: Math.round(h * logo.ratio), height: h } })
    ws.getRow(1).height = 22
    ws.getRow(2).height = 22
    ws.getRow(3).height = 12
    r = 4
  }
  const titleCell = ws.getCell(`A${r}`)
  titleCell.value = 'Estado de Resultados'
  titleCell.font = { size: 16, bold: true, color: { argb: GRAPHITE } }
  r++
  const subCell = ws.getCell(`A${r}`)
  subCell.value = `${company.name}${company.location ? ' · ' + company.location : ''}`
  subCell.font = { size: 11, bold: true }
  r++
  ws.getCell(`A${r}`).value = `Período: ${range.label}`
  ws.getCell(`A${r}`).font = { size: 10, color: { argb: 'FF6B7280' } }
  r += 2

  // Header de tabla
  const headerRow = r
  const headers = ['Concepto', 'Valor (COP)', '% Ingresos']
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAPHITE } }
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }
  })
  ws.getRow(headerRow).height = 18
  r++

  const thin = { style: 'thin', color: { argb: 'FFE5E7EB' } }
  for (const row of rows) {
    const cells = ws.getRow(r)
    const c1 = ws.getCell(r, 1)
    const c2 = ws.getCell(r, 2)
    const c3 = ws.getCell(r, 3)
    c1.value = (row.indent ? '    ' : '') + row.label
    c2.value = Math.round(row.value || 0)
    c2.numFmt = '"$"#,##0'
    c3.value = row.pct === '—' || row.pct == null ? row.pct : row.pct
    c2.alignment = { horizontal: 'right' }
    c3.alignment = { horizontal: 'right' }

    if (row.kind === 'section') {
      ;[c1, c2, c3].forEach((c) => {
        c.font = { bold: true, color: { argb: GRAPHITE } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      })
    } else if (row.kind === 'subtotal') {
      ;[c1, c2, c3].forEach((c) => {
        c.font = { bold: true }
        c.border = { top: thin }
      })
    } else if (row.kind === 'net') {
      const green = st.netProfit >= 0
      ;[c1, c2, c3].forEach((c) => {
        c.font = { bold: true, size: 12, color: { argb: green ? 'FF166534' : 'FF991B1B' } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green ? 'FFDCFCE7' : 'FFFEE2E2' } }
        c.border = { top: { style: 'medium', color: { argb: GRAPHITE } } }
      })
    } else {
      c1.font = { color: { argb: 'FF374151' } }
    }
    void cells
    r++
  }

  // Resumen de márgenes
  r += 1
  ws.getCell(`A${r}`).value = 'Indicadores'
  ws.getCell(`A${r}`).font = { bold: true, color: { argb: GRAPHITE } }
  r++
  const margins = [
    ['Margen bruto', st.grossMargin],
    ['Margen operacional', st.operatingMargin],
    ['Margen neto', st.netMargin],
  ]
  for (const [label, val] of margins) {
    ws.getCell(`A${r}`).value = label
    const mc = ws.getCell(`B${r}`)
    mc.value = val / 100
    mc.numFmt = '0.0%'
    mc.alignment = { horizontal: 'right' }
    r++
  }

  await wb.xlsx.writeFile(outPath)
}

// ───────── PDF ─────────
function buildPdf(st, rows, company, logo, range, outPath) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mL = 18
  const mR = pageW - 18
  let y = 18

  // Logo
  if (logo) {
    const h = 18
    const w = Math.min(h * logo.ratio, 60)
    try { doc.addImage(logo.dataUrl, logo.fmt, mL, y, w, h) } catch { /* ignore */ }
  }
  // Título a la derecha
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(55, 65, 81)
  doc.text('Estado de Resultados', mR, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(`${company.name}${company.location ? ' · ' + company.location : ''}`, mR, y + 12, { align: 'right' })
  doc.text(`Período: ${range.label}`, mR, y + 17, { align: 'right' })
  y += 26

  // Header de tabla
  const colValX = mR - 28
  const colPctX = mR
  doc.setFillColor(55, 65, 81)
  doc.rect(mL, y, mR - mL, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Concepto', mL + 2, y + 5.5)
  doc.text('Valor (COP)', colValX, y + 5.5, { align: 'right' })
  doc.text('% Ing.', colPctX - 1, y + 5.5, { align: 'right' })
  y += 8

  const lineH = 6.4
  doc.setFontSize(9)
  for (const row of rows) {
    if (y > pageH - 24) { doc.addPage(); y = 20 }
    const isSection = row.kind === 'section'
    const isSubtotal = row.kind === 'subtotal'
    const isNet = row.kind === 'net'

    if (isSection) {
      doc.setFillColor(243, 244, 246)
      doc.rect(mL, y, mR - mL, lineH, 'F')
    } else if (isNet) {
      const green = st.netProfit >= 0
      doc.setFillColor(...(green ? [220, 252, 231] : [254, 226, 226]))
      doc.rect(mL, y, mR - mL, lineH + 1, 'F')
    }
    if (isSubtotal || isNet) {
      doc.setDrawColor(55, 65, 81)
      doc.setLineWidth(isNet ? 0.5 : 0.2)
      doc.line(mL, y, mR, y)
    }

    if (isNet) doc.setTextColor(...(st.netProfit >= 0 ? [22, 101, 52] : [153, 27, 27]))
    else if (isSection || isSubtotal) doc.setTextColor(31, 41, 55)
    else doc.setTextColor(75, 85, 99)
    doc.setFont('helvetica', isSection || isSubtotal || isNet ? 'bold' : 'normal')
    doc.setFontSize(isNet ? 10.5 : 9)

    const ty = y + (isNet ? 5 : 4.5)
    const label = (row.indent ? '   ' : '') + row.label
    doc.text(label, mL + 2, ty)
    doc.text(COP(row.value), colValX, ty, { align: 'right' })
    doc.text(row.pct == null ? '' : row.pct, colPctX - 1, ty, { align: 'right' })
    y += isNet ? lineH + 1 : lineH
  }

  // Indicadores
  y += 6
  if (y > pageH - 30) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(55, 65, 81)
  doc.text('Indicadores', mL, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(75, 85, 99)
  const margins = [
    ['Margen bruto', st.grossMargin],
    ['Margen operacional', st.operatingMargin],
    ['Margen neto', st.netMargin],
  ]
  for (const [label, val] of margins) {
    doc.text(label, mL + 2, y)
    doc.text(val.toFixed(1) + '%', mL + 60, y, { align: 'right' })
    y += 5.5
  }

  // Footer
  doc.setFontSize(7.5)
  doc.setTextColor(156, 163, 175)
  doc.text(`Generado por BusinessHub · ${fmtDate(new Date())}`, mL, pageH - 10)

  const buf = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(outPath, buf)
}

// ───────── Main ─────────
async function main() {
  console.log(`Proyecto: ${PROJECT_ID}\n`)
  const company = await findBlueManila()
  if (!company) { console.error('No se encontró ninguna company Blue.'); process.exit(1) }
  console.log(`\n→ Empresa: id=${company.id} name="${company.name}" location="${company.location ?? ''}"`)
  console.log(`  logo: ${company.logo || '(sin logo)'}\n`)

  const snap = await db.collection('companies').doc(company.id).collection('transactions').get()
  const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  console.log(`Transacciones totales: ${txs.length}`)
  for (const t of txs) {
    if (CATEGORY_RENAMES[t.id]) {
      console.log(`↻ Recategorizada ${t.id}: "${t.category}" → "${CATEGORY_RENAMES[t.id]}" (${COP(t.amount)})`)
      t.category = CATEGORY_RENAMES[t.id]
    }
  }
  if (MANUAL_ADJUSTMENTS.length) {
    txs.push(...MANUAL_ADJUSTMENTS)
    console.log(`+ ${MANUAL_ADJUSTMENTS.length} ajuste(s) manual(es): ${MANUAL_ADJUSTMENTS.map((m) => `${m.concept} (${COP(m.amount)})`).join('; ')}`)
  }

  // Rango: por defecto todo el histórico (según fechas reconocidas).
  const allDates = txs
    .map((t) => (t.type === 'income' ? toDate(t.date) : recognitionDate(t)))
    .filter(Boolean)
  const minD = allDates.length ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : new Date()
  const maxD = allDates.length ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : new Date()
  const startDate = fromArg ? new Date(fromArg + 'T00:00:00') : new Date(minD.getFullYear(), minD.getMonth(), minD.getDate(), 0, 0, 0)
  const endDate = toArg ? new Date(toArg + 'T23:59:59') : new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate(), 23, 59, 59)
  const rangeLabel = `${fmtDate(startDate)} a ${fmtDate(endDate)}`
  const range = { label: rangeLabel }

  const st = computeStatement(txs, startDate, endDate)
  const rows = buildRows(st)

  // Resumen en consola
  console.log(`\nRango cubierto: ${rangeLabel}`)
  console.log('─'.repeat(56))
  console.log(`Ingresos Operacionales : ${COP(st.revenue.total)}`)
  console.log(`Costo de Ventas        : ${COP(st.costOfSales.total)}  (${fmtPct(st.costOfSales.total, st.base)})`)
  console.log(`Utilidad Bruta         : ${COP(st.grossProfit)}  (margen ${st.grossMargin.toFixed(1)}%)`)
  console.log(`Gastos Operacionales   : ${COP(st.operatingExpenses.total)}  (${fmtPct(st.operatingExpenses.total, st.base)})`)
  console.log(`Utilidad Operacional   : ${COP(st.operatingProfit)}  (margen ${st.operatingMargin.toFixed(1)}%)`)
  console.log(`Otros Ingresos         : ${COP(st.otherIncome.total)}`)
  console.log(`Otros Gastos           : ${COP(st.otherExpenses.total)}`)
  console.log(`Utilidad Neta          : ${COP(st.netProfit)}  (margen ${st.netMargin.toFixed(1)}%)`)
  console.log('─'.repeat(56))
  console.log('\nGastos operacionales por categoría (% de ingresos):')
  for (const c of st.operatingExpenses.categories) {
    console.log(`  · ${c.category.padEnd(28)} ${COP(c.total).padStart(16)}  ${fmtPct(c.total, st.base)}`)
  }
  if (st.costOfSales.categories.length) {
    console.log('Costo de ventas por categoría:')
    for (const c of st.costOfSales.categories) {
      console.log(`  · ${c.category.padEnd(28)} ${COP(c.total).padStart(16)}  ${fmtPct(c.total, st.base)}`)
    }
  }

  const logo = await loadLogo(company)

  const outDir = join(homedir(), 'Downloads', 'Estado-Resultados-Blue-Manila')
  mkdirSync(outDir, { recursive: true })
  const slug = `${fmtDate(startDate)}_a_${fmtDate(endDate)}`
  const xlsxPath = join(outDir, `Estado-Resultados-Blue-Manila_${slug}.xlsx`)
  const pdfPath = join(outDir, `Estado-Resultados-Blue-Manila_${slug}.pdf`)

  await buildExcel(st, rows, company, logo, range, xlsxPath)
  buildPdf(st, rows, company, logo, range, pdfPath)

  console.log(`\n✓ Excel: ${xlsxPath}`)
  console.log(`✓ PDF:   ${pdfPath}`)
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  if (err.code === 16 || /UNAUTHENTICATED/i.test(err.message || '')) {
    console.error('\nAutenticación fallida. Corre: gcloud auth application-default login')
  }
  console.error(err.stack)
  process.exit(1)
})
