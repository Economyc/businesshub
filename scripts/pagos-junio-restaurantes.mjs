#!/usr/bin/env node
// Genera, por cada restaurante (Blue Manila, Blue Escondite, Filipo Belén), un
// Excel con TODOS LOS PAGOS QUE SE HICIERON en el mes (dinero que salió de caja),
// pensado como base para calcular el PUNTO DE EQUILIBRIO real de cada negocio.
//
// A diferencia del Estado de Resultados / "Ventas vs Costos" (que ubican el gasto
// por su fecha de DEVENGO, recognitionDate), aquí lo que importa es "lo que
// pagamos en junio": se filtra por paidDate (fallback a date), la fecha efectiva
// del desembolso.
//
// Sobre esta base el usuario agrega a mano lo que el sistema aún no tiene cargado
// (salarios, bonos, seguridad social, etc.). Por eso el Excel trae:
//   · Hoja Resumen con clasificación Fijo/Variable EDITABLE, filas en blanco para
//     los agregados manuales, y un bloque de Punto de Equilibrio con FÓRMULAS
//     VIVAS (recalcula solo al escribir). Ventas del mes vienen del POS (editable).
//   · Hoja "Por proveedor": consolidado de lo pagado por proveedor.
//   · Hoja "Detalle de pagos": cada desembolso, auditable.
//   · Hoja "Excluidos": préstamos inter-locales / socios / propinas que NO son
//     costo operativo (se apartan para no inflar el PE, pero quedan visibles).
//
// Deja un .xlsx por local en ~/Downloads/Pagos-Junio-2026/.
//
// Uso:
//   node scripts/pagos-junio-restaurantes.mjs                          # los 3, junio 2026
//   node scripts/pagos-junio-restaurantes.mjs --from 2026-06-01 --to 2026-06-30
//   node scripts/pagos-junio-restaurantes.mjs --company 36dNFE9OH1ISyGXZ5GKe   # solo uno
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

// Locales objetivo. Escondite no está hardcodeado: se resuelve por location.
const COMPANIES = [
  { key: 'blue-manila', label: 'Blue Manila', id: '36dNFE9OH1ISyGXZ5GKe' },
  { key: 'blue-escondite', label: 'Blue Escondite', id: null }, // resuelto en runtime
  { key: 'filipo-belen', label: 'Filipo Belén', id: 'C06xQypKRqtVenO4ZLfy' },
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
const fromStr = args.from || '2026-06-01' // YYYY-MM-DD
const toStr = args.to || '2026-06-30'
const onlyCompany = args.company || null // si se pasa, solo ese id

// ───────── Helpers ─────────
const num = (v) => Number(v) || 0
const normalize = (s) =>
  (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const normalizeCat = (category) =>
  (category ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' > ')[0].trim()
const COP = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const fmtPct = (n, base) => (base > 0 ? ((n / base) * 100).toFixed(1) + '%' : '—')
const toDate = (ts) => ts?.toDate?.() ?? (ts instanceof Date ? ts : null)
const fmtDate = (d) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : '—'

// Fecha efectiva del pago (lo que salió de caja). Fallback a date.
const paymentDate = (t) => toDate(t.paidDate) ?? toDate(t.date)
// Monto efectivamente pagado. En parciales (Ecore) usa paidAmount si existe.
const paidAmountOf = (t) =>
  t.status === 'partial' && t.paidAmount != null ? num(t.paidAmount) : num(t.amount)

// ───────── Clasificación de costos ─────────
// Costo VARIABLE (se mueve con las ventas): materia prima, insumos, empaques,
// comisiones de plataformas/datáfono. Todo lo demás = FIJO por defecto. Es solo
// un default: el usuario lo ajusta en el Excel y el Punto de Equilibrio (SUMIF)
// se recalcula solo.
const VARIABLE_CATS = [
  'suministros', 'insumos', 'materia prima', 'materias primas', 'aliment', 'comida',
  'carne', 'bebida', 'empaque', 'desechable', 'mercancia', 'comision plataformas',
  'comisiones', 'rappi', 'datafono', 'compras', // "Compras" = materia prima (confirmado por el usuario)
]
function classifyFixedVariable(category) {
  const norm = normalizeCat(category)
  const full = normalize(category)
  if (VARIABLE_CATS.some((c) => norm.includes(c) || full.includes(c))) return 'Variable'
  return 'Fijo'
}

// Subcategoría normalizada (parte después de " > ").
const subCat = (category) =>
  (category ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' > ')[1]?.trim() || ''

// Clasifica un movimiento pagado. Devuelve:
//   'cost'                → entra al costo/PE (caso normal)
//   'excl:<motivo>'       → se aparta (no entra al PE), con el motivo para la hoja Excluidos
// Reglas de exclusión:
//   · préstamos inter-locales / socios          → financiación, no costo
//   · propinas                                   → dinero de los empleados (entra y sale)
//   · Nómina > Salarios (o "Nómina" sin sub)     → salario regular; en base DEVENGO se
//                                                  reemplaza por la colilla de junio (SALARIOS_MANUAL)
//   · Nómina > Liquidación/Prestaciones          → pago puntual, fuera del mes típico
//   · Nómina > Bonos (y "Bono" suelto)           → SE MANTIENE como costo
function classifyMovement(t) {
  if (t.interLocalGroupId) return 'excl:Préstamo inter-locales'
  const madre = normalizeCat(t.category)
  const sub = subCat(t.category)
  if (madre === 'socio' || madre.includes('prestamo')) return 'excl:Socios / préstamo'
  if (normalize(t.category).includes('propina')) return 'excl:Propinas'
  if (madre === 'nomina') {
    if (sub.includes('liquidac') || sub.includes('prestacion')) return 'excl:Liquidaciones (puntual, fuera del mes típico)'
    if (sub.includes('bono')) return 'excl:Bono del sistema (reemplazado por el bono mensual)'
    return 'excl:Salario del sistema (reemplazado por colilla de junio)'
  }
  // Bono como categoría suelta (Filipo lo registra así) → también se reemplaza.
  if (madre === 'bono') return 'excl:Bono del sistema (reemplazado por el bono mensual)'
  // Impuestos: los nacionales (DIAN = IVA / retención en la fuente) NO son gasto,
  // son un pasivo que se recauda y se gira → fuera del PE. Los municipales
  // (ICA / Industria y Comercio) SÍ son gasto operativo (sobre ingresos).
  if (madre.includes('impuesto')) {
    const who = normalize(t.payeeRef?.name) + ' ' + normalize(t.concept)
    if (who.includes('dian')) return 'excl:Impuestos nacionales DIAN (IVA / retención — no son gasto, se recaudan y giran)'
    return 'cost' // ICA municipal
  }
  return 'cost'
}

// Resuelve identidad del proveedor/beneficiario. OJO: pagos externos traen
// payeeRef.id = "external" (centinela) o vacío; si agrupáramos por ese id
// fundiríamos proveedores distintos. Sin id real → agrupar por NOMBRE.
function resolvePayee(ref, supMap) {
  ref = ref || {}
  const realId = ref.id && ref.id !== 'external' ? ref.id : null
  const sup = realId ? supMap.get(realId) : null
  const name = (ref.name || sup?.name || 'Sin proveedor').toString().trim() || 'Sin proveedor'
  const key = realId ? 'id:' + realId : ref.name ? 'name:' + normalize(name) : 'Sin proveedor'
  const category = sup?.category || (ref.type ? `(${ref.type})` : 'Sin categoría')
  return { key, name, category }
}

// ───────── Init Firestore ─────────
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

// ───────── Resolver Blue Escondite por location ─────────
async function resolveEscondite() {
  const snap = await db.collection('companies').get()
  const matches = snap.docs.filter((d) => {
    const data = d.data()
    return normalize(data.name).includes('blue') && normalize(data.location) === 'escondite'
  })
  if (matches.length === 0) throw new Error('No encontré ninguna empresa Blue + Escondite.')
  if (matches.length > 1) {
    for (const m of matches) console.error(`  - id=${m.id} name="${m.data().name}" location="${m.data().location}"`)
    throw new Error(`${matches.length} empresas coinciden con Blue + Escondite; abortando para no adivinar.`)
  }
  return matches[0].id
}

// ───────── Lado PAGOS (transactions, por paidDate) ─────────
async function loadPayments(companyId, companyKey) {
  const corrections = CORRECTIONS[companyKey] || {}
  const reclassify = RECLASSIFY[companyKey] || []
  const snap = await db.collection('companies').doc(companyId).collection('transactions').get()
  const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const startDate = new Date(fromStr + 'T00:00:00')
  const endDate = new Date(toStr + 'T23:59:59')
  const inRange = (d) => !!d && d >= startDate && d <= endDate

  const paidExpenses = txs.filter(
    (t) => t.type === 'expense' && (t.status === 'paid' || t.status === 'partial') && inRange(paymentDate(t)),
  )

  const costs = [] // { t, tipo, amount, date }
  const excluded = [] // { t, amount, date, reason }
  for (const t of paidExpenses) {
    const amount = paidAmountOf(t)
    const date = paymentDate(t)
    const cls = classifyMovement(t)
    const correction = corrections[normalizeCat(t.category)] // exclusión puntual por local
    if (cls === 'cost' && !correction) {
      // Reubicación puntual (categoría mal puesta) por monto exacto.
      const rc = reclassify.find((r) => normalizeCat(t.category) === r.whenMadre && amount === r.whenAmount)
      if (rc) t.category = rc.toCategory
      // El único impuesto que llega a 'cost' es el ICA municipal → variable (sobre ingresos).
      const tipo = rc
        ? rc.toTipo
        : normalizeCat(t.category).includes('impuesto') ? 'Variable' : classifyFixedVariable(t.category)
      costs.push({ t, tipo, amount, date })
    } else {
      excluded.push({ t, amount, date, reason: correction || cls.slice(5) }) // quita "excl:"
    }
  }
  return { costs, excluded }
}

// ───────── Lado VENTAS (POS neto) ─────────
async function loadPosNet(companyId) {
  const snap = await db
    .collection('companies').doc(companyId).collection('pos-sales-cache')
    .where('date', '>=', fromStr).where('date', '<=', toStr)
    .get()
  let netTotal = 0
  let count = 0
  for (const d of snap.docs) {
    for (const v of d.data().ventas ?? []) {
      if (normalize(v.estado_txt) === 'comprobante anulado') continue
      netTotal += num(v.total)
      count++
    }
  }
  return { netTotal, count }
}

// Días del período sin cobertura POS (avisa huecos sin truncar en silencio).
async function checkPosCoverage(companyId) {
  const month = fromStr.slice(0, 7) // YYYY-MM
  const doc = await db
    .collection('companies').doc(companyId).collection('pos-sales-cache-meta').doc(month)
    .get()
  const covered = new Set()
  if (doc.exists) {
    const days = doc.data().days || {}
    for (const key of Object.keys(days)) covered.add(key.slice(0, 10))
  }
  const missing = []
  const start = new Date(fromStr + 'T00:00:00')
  const end = new Date(toStr + 'T00:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!covered.has(fmtDate(d))) missing.push(fmtDate(d))
  }
  return missing
}

// ───────── Estilos Excel ─────────
const GRAPHITE = 'FF374151'
const THIN = { style: 'thin', color: { argb: 'FFE5E7EB' } }

function styleHeaderRow(ws, rowIdx, ncols) {
  for (let c = 1; c <= ncols; c++) {
    const cell = ws.getCell(rowIdx, c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAPHITE } }
    cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' }
  }
  ws.getRow(rowIdx).height = 18
}

// Hoja de tabla genérica.
function addTableSheet(wb, name, columns, rows, totalsRow) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns.map((c) => ({ width: c.width || 18 }))
  columns.forEach((c, i) => (ws.getCell(1, i + 1).value = c.header))
  styleHeaderRow(ws, 1, columns.length)
  let r = 2
  for (const row of rows) {
    columns.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1)
      cell.value = row[c.key]
      if (c.numFmt) cell.numFmt = c.numFmt
      cell.alignment = { horizontal: c.align || (i === 0 ? 'left' : 'right') }
    })
    r++
  }
  if (totalsRow) {
    columns.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1)
      cell.value = totalsRow[c.key]
      if (c.numFmt) cell.numFmt = c.numFmt
      cell.font = { bold: true }
      cell.border = { top: { style: 'medium', color: { argb: GRAPHITE } } }
      cell.alignment = { horizontal: c.align || (i === 0 ? 'left' : 'right') }
    })
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return ws
}

// Seguridad social: se paga MES VENCIDO, así que lo pagado el mes anterior es el
// costo que corresponde imputar al período. Valores por local (confirmados por el
// usuario). Se pre-llenan en la fila manual "Seguridad social" (editable igual).
const SEG_SOCIAL_MES_VENCIDO = {
  'blue-manila': 5000000,
  'blue-escondite': 1471000,
  'filipo-belen': 1960600,
}

// Salarios de JUNIO (neto colilla, sin propinas), tomados de las colillas reales
// de cada local (Q1 + Q2). Base DEVENGO: se carga a junio su propia nómina. Los
// salarios regulares que estén en el sistema pero sean de otro mes (p. ej. Manila
// "Nómina > Salarios" de mayo) se EXCLUYEN de los costos (ver excludeSystemSalary)
// para no duplicar. Editable en el Excel.
//   Manila   : Q1 $14.742.451 (incl. administrativos) + Q2 $10.306.187
//   Escondite: Q1 $4.362.104 + Q2 $4.934.830
//   Filipo   : Q1 $5.732.944 + Q2 $5.667.018
const SALARIOS_MANUAL = {
  'blue-manila': 25048638,
  'blue-escondite': 9296934,
  'filipo-belen': 11399961,
}

// ROI de los socios: NO es un gasto contable (es distribución de utilidad), pero
// el usuario lo trata como objetivo operativo para que el negocio "cubra" ese
// retorno. Se carga como costo fijo → sube el punto de equilibrio a propósito.
const ROI_SOCIOS = {
  'blue-manila': 11362842,
}

// Bonos mensuales a empleados (cifra canónica del usuario). REEMPLAZAN a los
// bonos que ya están en el sistema: esos se excluyen en classifyMovement para no
// doblar. Editable en el Excel.
const BONOS_MANUAL = {
  'blue-manila': 850000,
  'blue-escondite': 1400000,
  'filipo-belen': 900000,
}

// Correcciones puntuales por local (revisadas con el usuario): categorías (madre
// normalizada) que salen del costo del mes típico. Motivo se muestra en Excluidos.
const CORRECTIONS = {
  'blue-manila': {
    'bancos': 'Salario de Daniel Duque mal categorizado (ya está en la colilla de junio)',
    'servicio abogadas': 'Servicio jurídico (puntual, fuera del mes típico)',
    'arriendo / local': 'Oficina administrativa: se reparte 1/3 entre los locales (ver línea "Oficina administrativa")',
  },
  'filipo-belen': {
    'capacitacion': 'Capacitación (puntual, fuera del mes típico)',
  },
}

// Reubicaciones puntuales: transacciones mal categorizadas que hay que mover a
// otra categoría/tipo (identificadas por categoría madre + monto exacto).
const RECLASSIFY = {
  'filipo-belen': [
    // Un pago de $81.500 quedó dentro de "Arriendo" pero es un proveedor de
    // postres → materia prima (variable).
    { whenMadre: 'arriendo', whenAmount: 81500, toCategory: 'Materia prima / Postres', toTipo: 'Variable' },
  ],
}

// Oficina administrativa compartida: se paga desde Manila pero sirve a los 3
// locales → cada uno carga 1/3 ($800.000). En Manila el pago original ($2,4M)
// se excluye (arriba) y se reemplaza por esta cuota.
const OFICINA_ADMIN = {
  'blue-manila': 800000,
  'blue-escondite': 800000,
  'filipo-belen': 800000,
}

// Sugerencias de conceptos a agregar a mano (montos vacíos para que él los llene).
// La clave `fill` liga la fila con un valor pre-cargado por local si existe.
const MANUAL_ROWS = [
  { label: 'Salarios de junio (colillas)', tipo: 'Fijo', fill: 'salarios' },
  { label: 'Bonos a empleados (mensual)', tipo: 'Fijo', fill: 'bonos' },
  { label: 'Seguridad social (mes vencido)', tipo: 'Fijo', fill: 'segSocial' },
  { label: 'Oficina administrativa (1/3)', tipo: 'Fijo', fill: 'oficinaAdmin' },
  { label: 'Prestaciones / Cesantías', tipo: 'Fijo' },
  { label: 'Parafiscales (caja/SENA/ICBF)', tipo: 'Fijo' },
  { label: 'ROI socios (retorno objetivo)', tipo: 'Fijo', fill: 'roiSocios' },
  { label: 'Otro concepto…', tipo: 'Fijo' },
  { label: 'Otro concepto…', tipo: 'Variable' },
  { label: 'Otro concepto…', tipo: 'Fijo' },
]

// ───────── Hoja Resumen + Punto de Equilibrio (fórmulas vivas) ─────────
function addResumenSheet(wb, company, catRows, pos, missing) {
  const prefill = {
    segSocial: SEG_SOCIAL_MES_VENCIDO[company.key] || null,
    salarios: SALARIOS_MANUAL[company.key] || null,
    roiSocios: ROI_SOCIOS[company.key] || null,
    bonos: BONOS_MANUAL[company.key] || null,
    oficinaAdmin: OFICINA_ADMIN[company.key] || null,
  }
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] })
  ws.columns = [{ width: 44 }, { width: 16 }, { width: 20 }]

  let r = 1
  ws.getCell(`A${r}`).value = 'Pagos del mes y Punto de Equilibrio'
  ws.getCell(`A${r}`).font = { size: 16, bold: true, color: { argb: GRAPHITE } }
  r++
  ws.getCell(`A${r}`).value = company.label
  ws.getCell(`A${r}`).font = { size: 11, bold: true }
  r++
  ws.getCell(`A${r}`).value = `Pagos realizados (por fecha de pago) · ${fromStr} a ${toStr}`
  ws.getCell(`A${r}`).font = { size: 10, color: { argb: 'FF6B7280' } }
  r++
  ws.getCell(`A${r}`).value =
    'Edita la columna Tipo (Fijo/Variable) y llena los conceptos que faltan: el TOTAL y el Punto de Equilibrio se recalculan solos.'
  ws.getCell(`A${r}`).font = { size: 9, italic: true, color: { argb: 'FF9CA3AF' } }
  ws.mergeCells(`A${r}:C${r}`)
  ws.getRow(r).height = 26
  ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: 'top' }
  r += 2

  const headerRow = r
  ;['Categoría', 'Tipo', 'Monto pagado (COP)'].forEach((h, i) => (ws.getCell(headerRow, i + 1).value = h))
  styleHeaderRow(ws, headerRow, 3)
  r++

  // Filas de datos del sistema (categoría madre agregada).
  const firstDataRow = r
  for (const row of catRows) {
    ws.getCell(r, 1).value = row.category
    ws.getCell(r, 2).value = row.tipo
    ws.getCell(r, 2).alignment = { horizontal: 'center' }
    const mc = ws.getCell(r, 3)
    mc.value = Math.round(row.total)
    mc.numFmt = '"$"#,##0'
    mc.alignment = { horizontal: 'right' }
    r++
  }

  // Separador + filas manuales (montos vacíos, editables).
  const sepRow = r
  ws.getCell(r, 1).value = 'Conceptos adicionales (agregar a mano)'
  ;[1, 2, 3].forEach((c) => {
    const cc = ws.getCell(r, c)
    cc.font = { bold: true, color: { argb: GRAPHITE } }
    cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
  })
  r++
  for (const m of MANUAL_ROWS) {
    const prefilled = m.fill ? prefill[m.fill] : null
    ws.getCell(r, 1).value = m.label
    ws.getCell(r, 1).font = { color: { argb: prefilled ? 'FF374151' : 'FF9CA3AF' } }
    ws.getCell(r, 2).value = m.tipo
    ws.getCell(r, 2).alignment = { horizontal: 'center' }
    const mc = ws.getCell(r, 3)
    if (prefilled) mc.value = Math.round(prefilled)
    mc.numFmt = '"$"#,##0'
    mc.alignment = { horizontal: 'right' }
    mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEFCE8' } } // amarillo tenue = editar
    r++
  }
  const lastDataRow = r - 1 // última fila con monto (incluye manuales)

  // TOTAL COSTOS (sistema + manuales). SUMIF sobre col B (Tipo) para variables/fijos.
  // Rango de montos = C{firstDataRow}:C{lastDataRow}, saltando la fila separador
  // (que no tiene monto, así que no afecta la suma).
  const tipoRange = `B${firstDataRow}:B${lastDataRow}`
  const montoRange = `C${firstDataRow}:C${lastDataRow}`

  const totalRow = r
  ws.getCell(r, 1).value = 'TOTAL COSTOS'
  const tc = ws.getCell(r, 3)
  tc.value = { formula: `SUM(${montoRange})` }
  tc.numFmt = '"$"#,##0'
  ;[1, 2, 3].forEach((c) => {
    const cc = ws.getCell(r, c)
    cc.font = { bold: true, size: 12 }
    cc.border = { top: { style: 'medium', color: { argb: GRAPHITE } } }
  })
  tc.alignment = { horizontal: 'right' }
  r += 2

  // ── Bloque Punto de Equilibrio ──
  ws.getCell(r, 1).value = 'PUNTO DE EQUILIBRIO'
  ws.getCell(r, 1).font = { bold: true, size: 13, color: { argb: GRAPHITE } }
  r++

  const putPE = (label, cellSpec, opts = {}) => {
    const c1 = ws.getCell(r, 1)
    const c3 = ws.getCell(r, 3)
    c1.value = label
    if (cellSpec.value != null) c3.value = cellSpec.value
    if (cellSpec.formula) c3.value = { formula: cellSpec.formula }
    c3.numFmt = opts.numFmt || '"$"#,##0'
    c3.alignment = { horizontal: 'right' }
    if (opts.editable) c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEFCE8' } }
    if (opts.bold) [c1, c3].forEach((c) => (c.font = { bold: true }))
    if (opts.highlight) {
      [c1, c3].forEach((c) => {
        c.font = { bold: true, size: 12, color: { argb: 'FF1D4ED8' } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
        c.border = { top: { style: 'medium', color: { argb: GRAPHITE } } }
      })
    }
    const thisRow = r
    r++
    return thisRow
  }

  const ventasRow = putPE('Ventas del mes (POS neto) — editable', { value: Math.round(pos.netTotal) }, { editable: true })
  const varRow = putPE('Costos variables', { formula: `SUMIF(${tipoRange},"Variable",${montoRange})` })
  const fijRow = putPE('Costos fijos', { formula: `SUMIF(${tipoRange},"Fijo",${montoRange})` })
  const mcRow = putPE(
    'Margen de contribución %',
    { formula: `IF(C${ventasRow}>0,(C${ventasRow}-C${varRow})/C${ventasRow},0)` },
    { numFmt: '0.0%', bold: true },
  )
  const peRow = putPE(
    'Punto de equilibrio ($/mes)',
    { formula: `IF(C${mcRow}>0,C${fijRow}/C${mcRow},0)` },
    { highlight: true },
  )
  putPE('Punto de equilibrio (diario, ÷30)', { formula: `C${peRow}/30` }, {})
  putPE(
    'Excedente / faltante vs ventas',
    { formula: `C${ventasRow}-C${peRow}` },
    { bold: true },
  )

  // Notas
  r += 1
  ws.getCell(r, 1).value = 'Notas'
  ws.getCell(r, 1).font = { bold: true, color: { argb: GRAPHITE } }
  r++
  const notes = [
    'Los montos del sistema son PAGOS realizados en el período (por fecha de pago, no por devengo).',
    'La nómina del mes en curso suele NO estar cargada aún: usa las filas amarillas para agregar salarios, seguridad social, bonos, etc.',
    'Punto de equilibrio = Costos fijos ÷ Margen de contribución %. Margen = (Ventas − Costos variables) ÷ Ventas.',
    'Préstamos entre locales, movimientos de socios y propinas NO se cuentan como costo (ver hoja "Excluidos").',
  ]
  if (missing.length) {
    notes.push(
      `⚠ POS: ${missing.length} día(s) sin cobertura en el período (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}). Las ventas del mes pueden estar subestimadas; ajústalas a mano.`,
    )
  }
  for (const n of notes) {
    const cell = ws.getCell(r, 1)
    cell.value = '• ' + n
    cell.font = { size: 9, color: { argb: 'FF6B7280' } }
    cell.alignment = { wrapText: true, vertical: 'top' }
    ws.mergeCells(`A${r}:C${r}`)
    ws.getRow(r).height = 24
    r++
  }
}

// ───────── Genera el Excel de un local ─────────
async function buildCompanyExcel(company, supMap, outDir) {
  const companyId = company.id
  const [{ costs, excluded }, pos, missing] = await Promise.all([
    loadPayments(companyId, company.key),
    loadPosNet(companyId),
    checkPosCoverage(companyId),
  ])

  // Agrupa costos por categoría MADRE (para la hoja Resumen). El Tipo dominante
  // de la madre = el del mayor monto entre sus movimientos.
  const catMap = new Map()
  for (const c of costs) {
    const madre = (c.t.category || 'Sin categoría').split(' > ')[0]
    let e = catMap.get(madre)
    if (!e) e = catMap.set(madre, { category: madre, total: 0, tipoTot: new Map() }).get(madre)
    e.total += c.amount
    e.tipoTot.set(c.tipo, (e.tipoTot.get(c.tipo) || 0) + c.amount)
  }
  const catRows = Array.from(catMap.values())
    .map((e) => ({
      category: e.category,
      total: e.total,
      tipo: (Array.from(e.tipoTot.entries()).sort((a, b) => b[1] - a[1])[0] || ['Fijo'])[0],
    }))
    .sort((a, b) => b.total - a.total)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'BusinessHub'

  // Hoja 1: Resumen + Punto de Equilibrio
  addResumenSheet(wb, company, catRows, pos, missing)

  // Hoja 2: Por proveedor (consolidado de lo pagado)
  const payeeMap = new Map()
  for (const c of costs) {
    const { key, name, category } = resolvePayee(c.t.payeeRef, supMap)
    const ex = payeeMap.get(key)
    if (ex) { ex.total += c.amount; ex.count++ }
    else payeeMap.set(key, { name, category, total: c.amount, count: 1 })
  }
  const payees = Array.from(payeeMap.values()).sort((a, b) => b.total - a.total)
  addTableSheet(
    wb,
    'Por proveedor',
    [
      { key: 'name', header: 'Proveedor / beneficiario', width: 38 },
      { key: 'category', header: 'Categoría proveedor', width: 24 },
      { key: 'total', header: 'Total pagado', width: 18, numFmt: '"$"#,##0' },
      { key: 'count', header: '# pagos', width: 10, numFmt: '#,##0' },
    ],
    payees.map((p) => ({ name: p.name, category: p.category, total: Math.round(p.total), count: p.count })),
    {
      name: 'TOTAL',
      category: '',
      total: Math.round(payees.reduce((s, p) => s + p.total, 0)),
      count: payees.reduce((s, p) => s + p.count, 0),
    },
  )

  // Hoja 3: Detalle de pagos
  addTableSheet(
    wb,
    'Detalle de pagos',
    [
      { key: 'date', header: 'Fecha pago', width: 12, align: 'left' },
      { key: 'concept', header: 'Concepto', width: 40, align: 'left' },
      { key: 'category', header: 'Categoría', width: 26, align: 'left' },
      { key: 'tipo', header: 'Tipo', width: 10, align: 'center' },
      { key: 'payee', header: 'Proveedor', width: 26, align: 'left' },
      { key: 'amount', header: 'Monto', width: 16, numFmt: '"$"#,##0' },
    ],
    costs
      .slice()
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .map((c) => ({
        date: fmtDate(c.date),
        concept: c.t.concept || '—',
        category: c.t.category || 'Sin categoría',
        tipo: c.tipo,
        payee: resolvePayee(c.t.payeeRef, supMap).name,
        amount: Math.round(c.amount),
      })),
    {
      date: '',
      concept: 'TOTAL',
      category: '',
      tipo: '',
      payee: '',
      amount: Math.round(costs.reduce((s, c) => s + c.amount, 0)),
    },
  )

  // Hoja 4: Excluidos (no costo)
  const exclByReason = new Map()
  for (const e of excluded) {
    let g = exclByReason.get(e.reason)
    if (!g) g = exclByReason.set(e.reason, { reason: e.reason, total: 0, count: 0 }).get(e.reason)
    g.total += e.amount
    g.count++
  }
  const wsX = wb.addWorksheet('Excluidos', { views: [{ showGridLines: false }] })
  wsX.columns = [{ width: 40 }, { width: 20 }, { width: 12 }]
  let xr = 1
  wsX.getCell(`A${xr}`).value = 'Movimientos excluidos del costo (no entran al Punto de Equilibrio)'
  wsX.getCell(`A${xr}`).font = { size: 13, bold: true, color: { argb: GRAPHITE } }
  wsX.mergeCells(`A${xr}:C${xr}`)
  xr += 2
  ;['Motivo', 'Total pagado', '# mov.'].forEach((h, i) => (wsX.getCell(xr, i + 1).value = h))
  styleHeaderRow(wsX, xr, 3)
  xr++
  for (const g of Array.from(exclByReason.values()).sort((a, b) => b.total - a.total)) {
    wsX.getCell(xr, 1).value = g.reason
    const tc = wsX.getCell(xr, 2)
    tc.value = Math.round(g.total)
    tc.numFmt = '"$"#,##0'
    tc.alignment = { horizontal: 'right' }
    const cc = wsX.getCell(xr, 3)
    cc.value = g.count
    cc.numFmt = '#,##0'
    cc.alignment = { horizontal: 'right' }
    xr++
  }
  // Total
  wsX.getCell(xr, 1).value = 'TOTAL EXCLUIDO'
  const xt = wsX.getCell(xr, 2)
  xt.value = Math.round(excluded.reduce((s, e) => s + e.amount, 0))
  xt.numFmt = '"$"#,##0'
  ;[1, 2, 3].forEach((c) => {
    const cc = wsX.getCell(xr, c)
    cc.font = { bold: true }
    cc.border = { top: { style: 'medium', color: { argb: GRAPHITE } } }
  })
  xt.alignment = { horizontal: 'right' }
  xr += 2
  wsX.getCell(`A${xr}`).value =
    'No entran al punto de equilibrio: préstamos entre locales y movimientos de socios (financiación, no costo); propinas (dinero de los empleados, entra y sale); salarios que están en el sistema pero son de otro mes (se reemplazan por la colilla de junio, base devengo); liquidaciones/indemnizaciones (pagos puntuales, no de un mes típico); e impuestos nacionales DIAN (IVA y retención en la fuente no son gasto, son un pasivo que se recauda y se gira). El ICA municipal SÍ queda como costo variable en el Resumen. Todo queda aquí para que sea visible.'
  wsX.getCell(`A${xr}`).font = { size: 9, italic: true, color: { argb: 'FF9CA3AF' } }
  wsX.mergeCells(`A${xr}:C${xr}`)
  wsX.getRow(xr).height = 40
  wsX.getCell(`A${xr}`).alignment = { wrapText: true, vertical: 'top' }

  // Escribe archivo
  const costTotal = costs.reduce((s, c) => s + c.amount, 0)
  const exclTotal = excluded.reduce((s, e) => s + e.amount, 0)
  const slug = company.label.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')
  const xlsxPath = join(outDir, `Pagos-Junio-2026_${slug}.xlsx`)
  await wb.xlsx.writeFile(xlsxPath)

  return { company, costTotal, exclTotal, pos, missing, xlsxPath, nCosts: costs.length }
}

// ───────── Main ─────────
async function main() {
  console.log(`Proyecto: ${PROJECT_ID}  ·  Período: ${fromStr} a ${toStr}\n`)

  // Resolver lista de locales a procesar.
  let targets = COMPANIES
  if (onlyCompany) {
    targets = COMPANIES.filter((c) => c.id === onlyCompany)
    if (targets.length === 0) targets = [{ key: 'custom', label: 'Empresa', id: onlyCompany }]
  }

  // Resolver Escondite si está en la lista y no se filtró por otro id.
  for (const c of targets) {
    if (c.id === null) {
      c.id = await resolveEscondite()
      console.log(`→ Blue Escondite resuelto: ${c.id}\n`)
    }
  }

  // Proveedores (colección raíz, compartida).
  const supSnap = await db.collection('suppliers').get()
  const supMap = new Map()
  for (const d of supSnap.docs) {
    const s = d.data()
    supMap.set(d.id, { name: s.name || '(sin nombre)', category: s.category || 'Sin categoría' })
  }

  const outDir = join(homedir(), 'Downloads')
  mkdirSync(outDir, { recursive: true })

  const results = []
  for (const company of targets) {
    console.log(`Procesando ${company.label} (${company.id})…`)
    results.push(await buildCompanyExcel(company, supMap, outDir))
  }

  // Resumen en consola
  console.log('\n' + '═'.repeat(64))
  for (const res of results) {
    console.log(`\n${res.company.label}`)
    console.log(`  Pagos (costo)        : ${COP(res.costTotal)}  (${res.nCosts} mov)`)
    console.log(`  Excluidos            : ${COP(res.exclTotal)}`)
    console.log(`  Ventas POS (neto)    : ${COP(res.pos.netTotal)}  (${res.pos.count} comprobantes)`)
    if (res.pos.netTotal > 0) {
      const mcVar = res.costTotal // aprox informativa (sin split fijo/var en consola)
      console.log(`  Costos / ventas      : ${fmtPct(mcVar, res.pos.netTotal)}`)
    }
    if (res.missing.length) {
      console.log(`  ⚠ POS sin cobertura  : ${res.missing.length} día(s) (${res.missing.slice(0, 6).join(', ')}${res.missing.length > 6 ? '…' : ''})`)
    }
    console.log(`  ✓ ${res.xlsxPath}`)
  }
  console.log('\n' + '═'.repeat(64))
  console.log(`\n✓ ${results.length} archivo(s) en: ${outDir}`)
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  if (err.code === 16 || /UNAUTHENTICATED/i.test(err.message || '')) {
    console.error('\nAutenticación fallida. Corre: gcloud auth application-default login')
  }
  console.error(err.stack)
  process.exit(1)
})
