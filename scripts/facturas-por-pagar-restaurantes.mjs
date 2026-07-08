#!/usr/bin/env node
// Genera UN solo Excel con TODAS LAS FACTURAS POR PAGAR (cuentas por pagar
// pendientes) de los 4 locales — una hoja por negocio: Blue Smash Manila,
// Blue Smash Escondite, Filippo Belén y Filippo San Lucas. Es la misma vista
// de Ecore (https://ecore.economyc.cc → Por Pagar → Proveedores) consolidada
// en un archivo; Ecore y este script leen la misma Firestore (empresas-bf).
//
// Alcance (idéntico al filtro de Ecore payables-view + useInvoicesPending):
//   type='expense' && documentKind='invoice'
//   && status in ['pending','overdue','partial'] && sin interLocalGroupId
// (pendientes, vencidas y parciales con saldo). NO incluye compras ni
// préstamos entre locales.
//
// Cada hoja lista, por factura: fecha de emisión, N° factura, proveedor,
// concepto, categoría, vencimiento, estado (Pendiente/Vencida/Parcial),
// prioridad (Urgente/Normal), monto y saldo pendiente. Urgentes y vencidas
// arriba; fila de totales al pie (suma de monto y de saldo).
//
// Deja un .xlsx en ~/Downloads/Facturas-Por-Pagar_YYYY-MM-DD.xlsx.
//
// Uso:
//   node scripts/facturas-por-pagar-restaurantes.mjs                        # los 4
//   node scripts/facturas-por-pagar-restaurantes.mjs --company 36dNFE9OH1ISyGXZ5GKe  # uno
//
// Autenticación: gcloud auth application-default login (ADC). Read-only.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))
const ExcelJS = require(join(__dirname, '../functions/node_modules/exceljs'))

const PROJECT_ID = 'empresas-bf'

// Locales objetivo (ids verificados en Firestore el 2026-07-08).
const COMPANIES = [
  { key: 'blue-manila', label: 'Blue Smash Manila', id: '36dNFE9OH1ISyGXZ5GKe' },
  { key: 'blue-escondite', label: 'Blue Smash Escondite', id: '3mU7Tld2uq1OjTLrgbQ2' },
  { key: 'filipo-belen', label: 'Filippo Belén', id: 'C06xQypKRqtVenO4ZLfy' },
  { key: 'filipo-san-lucas', label: 'Filippo San Lucas', id: 'L3yMbGCeVgL3pQvA1hi4' },
]

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
const onlyCompany = args.company || null // si se pasa, solo ese id

// ───────── Helpers ─────────
const num = (v) => Number(v) || 0
const COP = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const toDate = (ts) => ts?.toDate?.() ?? (ts instanceof Date ? ts : null)
const fmtDate = (d) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : '—'

const now = new Date()
const MS_DAY = 24 * 60 * 60 * 1000

// Saldo pendiente: en parciales (Ecore) es amount - paidAmount; si no, el total.
const saldoOf = (t) =>
  t.status === 'partial' && t.paidAmount != null ? num(t.amount) - num(t.paidAmount) : num(t.amount)

// Resuelve identidad del proveedor/beneficiario. OJO: pagos externos traen
// payeeRef.id = "external" (centinela) o vacío → agrupar/mostrar por NOMBRE.
function resolvePayee(ref, supMap) {
  ref = ref || {}
  const realId = ref.id && ref.id !== 'external' ? ref.id : null
  const sup = realId ? supMap.get(realId) : null
  const name = (ref.name || sup?.name || 'Sin proveedor').toString().trim() || 'Sin proveedor'
  return name
}

// ───────── Init Firestore ─────────
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

// ───────── Carga de facturas por pagar ─────────
async function loadPendingInvoices(companyId, supMap) {
  const snap = await db.collection('companies').doc(companyId).collection('transactions').get()
  const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // Mismo filtro que Ecore (useInvoicesPending + tab Proveedores): los préstamos
  // entre locales (interLocalGroupId) se gestionan en su propio tab, no aquí.
  const PENDING_STATUS = new Set(['pending', 'overdue', 'partial'])
  const pending = txs.filter(
    (t) =>
      t.type === 'expense' &&
      t.documentKind === 'invoice' &&
      PENDING_STATUS.has(t.status) &&
      !t.interLocalGroupId,
  )

  return pending.map((t) => {
    const date = toDate(t.date)
    const dueDate = toDate(t.dueDate)
    const vencida = t.status === 'overdue' || (dueDate ? dueDate < now : false)
    // Días vencida (positivo = ya venció). Sin dueDate → null (van al final).
    const diasVencida = dueDate ? Math.floor((now - dueDate) / MS_DAY) : null
    const estadoTxt = vencida ? 'Vencida' : t.status === 'partial' ? 'Parcial' : 'Pendiente'
    const prioridadTxt = t.priority === 'immediate' ? 'Urgente' : 'Normal'
    return {
      date: fmtDate(date),
      _dateSort: date ? date.getTime() : Number.MAX_SAFE_INTEGER,
      docNumber: t.docNumber || '—',
      payee: resolvePayee(t.payeeRef, supMap),
      concept: t.concept || '—',
      category: t.category || 'Sin categoría',
      dueDate: fmtDate(dueDate),
      estado: estadoTxt,
      prioridad: prioridadTxt,
      amount: Math.round(num(t.amount)),
      saldo: Math.round(saldoOf(t)),
      _urgente: t.priority === 'immediate' ? 1 : 0,
      _diasVencida: diasVencida,
    }
  })
}

// Orden: urgentes primero; luego más vencidas / vencimiento más próximo (mayor
// diasVencida primero, sin dueDate al final); desempate por fecha de emisión asc.
function sortInvoices(rows) {
  return rows.slice().sort((a, b) => {
    if (a._urgente !== b._urgente) return b._urgente - a._urgente
    const da = a._diasVencida
    const db_ = b._diasVencida
    if (da == null && db_ != null) return 1
    if (da != null && db_ == null) return -1
    if (da != null && db_ != null && da !== db_) return db_ - da
    return a._dateSort - b._dateSort
  })
}

// ───────── Estilos Excel ─────────
const GRAPHITE = 'FF374151'

function styleHeaderRow(ws, rowIdx, ncols) {
  for (let c = 1; c <= ncols; c++) {
    const cell = ws.getCell(rowIdx, c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAPHITE } }
    cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' }
  }
  ws.getRow(rowIdx).height = 18
}

const COLUMNS = [
  { key: 'date', header: 'Fecha emisión', width: 13, align: 'left' },
  { key: 'docNumber', header: 'N° factura', width: 14, align: 'left' },
  { key: 'payee', header: 'Proveedor', width: 34, align: 'left' },
  { key: 'concept', header: 'Concepto', width: 38, align: 'left' },
  { key: 'category', header: 'Categoría', width: 26, align: 'left' },
  { key: 'dueDate', header: 'Vencimiento', width: 13, align: 'left' },
  { key: 'estado', header: 'Estado', width: 12, align: 'center' },
  { key: 'prioridad', header: 'Prioridad', width: 11, align: 'center' },
  { key: 'amount', header: 'Monto factura', width: 16, numFmt: '"$"#,##0' },
  { key: 'saldo', header: 'Saldo pendiente', width: 16, numFmt: '"$"#,##0' },
]

// Añade una hoja con la tabla de facturas por pagar de un local.
function addCompanySheet(wb, company, rows) {
  const ws = wb.addWorksheet(company.label.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLUMNS.map((c) => ({ width: c.width || 18 }))
  COLUMNS.forEach((c, i) => (ws.getCell(1, i + 1).value = c.header))
  styleHeaderRow(ws, 1, COLUMNS.length)

  if (rows.length === 0) {
    ws.getCell(2, 1).value = 'Sin facturas pendientes'
    ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF9CA3AF' } }
    return
  }

  let r = 2
  for (const row of rows) {
    COLUMNS.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1)
      cell.value = row[c.key]
      if (c.numFmt) cell.numFmt = c.numFmt
      cell.alignment = { horizontal: c.align || (i === 0 ? 'left' : 'right') }
      // Resalta en rojo tenue las vencidas y en negrita las urgentes.
      if (row.estado === 'Vencida' && (c.key === 'estado' || c.key === 'dueDate')) {
        cell.font = { color: { argb: 'FFB91C1C' }, bold: true }
      }
      if (row.prioridad === 'Urgente' && c.key === 'prioridad') {
        cell.font = { color: { argb: 'FFB91C1C' }, bold: true }
      }
    })
    r++
  }

  // Fila de totales (suma de monto y de saldo).
  const totalAmount = rows.reduce((s, x) => s + x.amount, 0)
  const totalSaldo = rows.reduce((s, x) => s + x.saldo, 0)
  COLUMNS.forEach((c, i) => {
    const cell = ws.getCell(r, i + 1)
    if (c.key === 'date') cell.value = 'TOTAL'
    else if (c.key === 'amount') cell.value = totalAmount
    else if (c.key === 'saldo') cell.value = totalSaldo
    if (c.numFmt) cell.numFmt = c.numFmt
    cell.font = { bold: true }
    cell.border = { top: { style: 'medium', color: { argb: GRAPHITE } } }
    cell.alignment = { horizontal: c.align || (i === 0 ? 'left' : 'right') }
  })

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } }
}

// ───────── Main ─────────
async function main() {
  console.log(`Proyecto: ${PROJECT_ID}  ·  Facturas por pagar (pendientes)\n`)

  // Resolver lista de locales a procesar.
  let targets = COMPANIES
  if (onlyCompany) {
    targets = COMPANIES.filter((c) => c.id === onlyCompany)
    if (targets.length === 0) targets = [{ key: 'custom', label: 'Empresa', id: onlyCompany }]
  }

  // Proveedores (colección raíz, compartida).
  const supSnap = await db.collection('suppliers').get()
  const supMap = new Map()
  for (const d of supSnap.docs) {
    const s = d.data()
    supMap.set(d.id, { name: s.name || '(sin nombre)', category: s.category || 'Sin categoría' })
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'BusinessHub'

  const summary = []
  for (const company of targets) {
    console.log(`Procesando ${company.label} (${company.id})…`)
    const rows = sortInvoices(await loadPendingInvoices(company.id, supMap))
    addCompanySheet(wb, company, rows)
    summary.push({
      label: company.label,
      count: rows.length,
      saldo: rows.reduce((s, x) => s + x.saldo, 0),
      vencidas: rows.filter((x) => x.estado === 'Vencida').length,
    })
  }

  const outDir = join(homedir(), 'Downloads')
  mkdirSync(outDir, { recursive: true })
  const stamp = fmtDate(now)
  const xlsxPath = join(outDir, `Facturas-Por-Pagar_${stamp}.xlsx`)
  await wb.xlsx.writeFile(xlsxPath)

  // Resumen en consola.
  console.log('\n' + '═'.repeat(64))
  for (const s of summary) {
    console.log(`\n${s.label}`)
    console.log(`  Facturas pendientes : ${s.count}  (${s.vencidas} vencida(s))`)
    console.log(`  Saldo por pagar     : ${COP(s.saldo)}`)
  }
  console.log('\n' + '═'.repeat(64))
  console.log(`\n✓ ${xlsxPath}`)
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  if (err.code === 16 || /UNAUTHENTICATED/i.test(err.message || '')) {
    console.error('\nAutenticación fallida. Corre: gcloud auth application-default login')
  }
  console.error(err.stack)
  process.exit(1)
})
