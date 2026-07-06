#!/usr/bin/env node
// Lee un extracto bancario de Bancolombia (el .xlsx que exporta la sucursal
// virtual — que ExcelJS no abre directo porque trae una estructura mínima) y
// genera un CONSOLIDADO por beneficiario/concepto en Excel.
//
// Objetivo: saber "cuánto se me va" en cada cosa (Facebook, DIAN/impoconsumo,
// Google, proveedores, costos bancarios, etc.). OJO: las líneas "TRANSFERENCIA"
// del banco NO traen el beneficiario, así que se agrupan como una sola bolsa
// "sin beneficiario" — para saber a quién fueron hay que cruzarlas con la
// contabilidad (el Excel de Pagos ya lo hace por proveedor).
//
// Uso:
//   node scripts/consolidado-extracto-banco.mjs --file "C:/.../extracto.xlsx" --label "Blue Manila"
//
// No usa Firestore. Solo lee el archivo local.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const JSZip = require(join(__dirname, '../functions/node_modules/jszip'))
const ExcelJS = require(join(__dirname, '../functions/node_modules/exceljs'))

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
const filePath = args.file || 'C:/Users/sbdbu/Downloads/26700001894_202606_4496243598.xlsx'
const label = args.label || 'Blue Manila'

// ───────── Helpers ─────────
const N = (s) => Number(String(s ?? '').replace(/,/g, '')) || 0
const COP = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const GRAPHITE = 'FF374151'

// Normaliza la descripción del banco a un beneficiario/concepto consolidable.
function beneficiario(descRaw) {
  const d = (descRaw || '').toUpperCase().replace(/\s+/g, ' ').trim()
  if (/TRANSFERENCIA/.test(d)) return 'Transferencias (sin beneficiario en el banco)'
  if (/ABONO NETO (MASTER|VISA|AMEX)/.test(d)) return 'Recaudo tarjetas (datáfono)'
  if (/CONSIGNACION CORRESPONSAL/.test(d)) return 'Consignaciones en efectivo'
  if (/INTERES/.test(d)) return 'Intereses de ahorro'
  if (/4X1000/.test(d)) return 'GMF (4x1000)'
  if (/CUOTA PLAN|IVA CUOTA|MANEJO TARJ|C MANEJO|CUOTA MANEJO/.test(d)) return 'Costos bancarios (plan/manejo)'
  if (/FACEBK|FACEBOOK|META PLATFORM/.test(d)) return 'Facebook / Meta (publicidad)'
  if (/GOOGLE|WORKSPACE/.test(d)) return 'Google'
  if (/APPLE/.test(d)) return 'Apple'
  if (/CANVA/.test(d)) return 'Canva'
  if (/DIAN/.test(d)) return 'DIAN (impoconsumo / IVA / retención)'
  if (/DISTRITO ESPECIAL|HACIENDA/.test(d)) return 'ICA / Distrito (Sec. Hacienda)'
  if (/SIIGO/.test(d)) return 'Siigo (software contable)'
  if (/\bUNE\b|EPM/.test(d)) return 'Servicios públicos (UNE / EPM)'
  if (/COMAPAN/.test(d)) return 'Comapan (proveedor)'
  if (/ENLACE OPERATIVO/.test(d)) return 'Enlace Operativo'
  if (/FONDO DE INVERSION/.test(d)) return 'Fondo de inversión (ahorro)'
  if (/RCI COLOMBIA/.test(d)) return 'RCI Colombia'
  // genéricos con nombre: quita el prefijo y el código de transacción al final
  let name = d.replace(/^(COMPRA EN|COMPRA INTL|PAGO PSE|PAGO SV|PAGO INTERBANC)\s*/, '')
  name = name.replace(/\s+[A-Z0-9]{6,}$/, '').trim()
  return name ? name.charAt(0) + name.slice(1).toLowerCase() : 'Otros'
}

// ───────── Parseo del extracto ─────────
async function parseExtracto(path) {
  const zip = await JSZip.loadAsync(readFileSync(path))
  const xml = await zip.file('xl/worksheets/sheet1.xml').async('string')
  const rows = xml.split('<x:row').slice(1).map((r) =>
    [...r.matchAll(/<x:v>([\s\S]*?)<\/x:v>/g)].map((m) =>
      m[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim(),
    ),
  )

  // Resumen (fila con SALDO ANTERIOR ... y la siguiente con valores)
  let resumen = null
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] || '').toUpperCase() === 'SALDO ANTERIOR') {
      const v = rows[i + 1] || []
      resumen = {
        saldoAnterior: N(v[0]), totalAbonos: N(v[1]), totalCargos: N(v[2]),
        saldoActual: N(v[3]), saldoPromedio: N(v[4]),
      }
      break
    }
  }
  // Período
  let desde = '', hasta = ''
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] || '').toUpperCase() === 'DESDE') {
      desde = (rows[i + 1] || [])[0] || ''
      hasta = (rows[i + 1] || [])[1] || ''
      break
    }
  }

  // Movimientos: fila con FECHA d/m y VALOR numérico en la col 5 (índice 4)
  const movs = []
  for (const c of rows) {
    if (!/^\d{1,2}\/\d{1,2}$/.test(c[0] || '')) continue
    if (!c[4] || !/[0-9]/.test(c[4])) continue
    const valor = N(c[4])
    movs.push({
      fecha: c[0], desc: c[1] || '', valor,
      benef: beneficiario(c[1] || ''), saldo: N(c[5]),
    })
  }
  return { resumen, desde, hasta, movs }
}

// ───────── Excel ─────────
function styleHeaderRow(ws, rowIdx, ncols) {
  for (let cc = 1; cc <= ncols; cc++) {
    const cell = ws.getCell(rowIdx, cc)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAPHITE } }
    cell.alignment = { horizontal: cc === 1 ? 'left' : 'right', vertical: 'middle' }
  }
  ws.getRow(rowIdx).height = 18
}

function addConsolidado(wb, name, entries, valueKey, subtitle) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [{ width: 46 }, { width: 20 }, { width: 12 }, { width: 12 }]
  ;['Beneficiario / concepto', 'Monto', '# mov', '% del total'].forEach((h, i) => (ws.getCell(1, i + 1).value = h))
  styleHeaderRow(ws, 1, 4)
  const total = entries.reduce((s, e) => s + e[valueKey], 0)
  let r = 2
  for (const e of entries) {
    ws.getCell(r, 1).value = e.benef
    const c2 = ws.getCell(r, 2); c2.value = Math.round(e[valueKey]); c2.numFmt = '"$"#,##0'; c2.alignment = { horizontal: 'right' }
    const c3 = ws.getCell(r, 3); c3.value = e.n; c3.numFmt = '#,##0'; c3.alignment = { horizontal: 'right' }
    const c4 = ws.getCell(r, 4); c4.value = total > 0 ? e[valueKey] / total : 0; c4.numFmt = '0.0%'; c4.alignment = { horizontal: 'right' }
    if (/sin beneficiario/i.test(e.benef)) [ws.getCell(r,1)].forEach(c => c.font = { italic: true, color: { argb: 'FF92400E' } })
    r++
  }
  ws.getCell(r, 1).value = 'TOTAL'
  const t2 = ws.getCell(r, 2); t2.value = Math.round(total); t2.numFmt = '"$"#,##0'; t2.alignment = { horizontal: 'right' }
  ;[1, 2, 3, 4].forEach((c) => { const cc = ws.getCell(r, c); cc.font = { bold: true }; cc.border = { top: { style: 'medium', color: { argb: GRAPHITE } } } })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } }
}

async function main() {
  console.log(`Extracto: ${filePath}\n`)
  const { resumen, desde, hasta, movs } = await parseExtracto(filePath)
  if (!movs.length) { console.error('No encontré movimientos en el extracto.'); process.exit(1) }

  // Consolidar por beneficiario, separando entradas (valor>0) y salidas (valor<0)
  const inMap = new Map(), outMap = new Map()
  for (const m of movs) {
    const target = m.valor >= 0 ? inMap : outMap
    let g = target.get(m.benef)
    if (!g) g = target.set(m.benef, { benef: m.benef, in: 0, out: 0, n: 0 }).get(m.benef)
    if (m.valor >= 0) g.in += m.valor; else g.out += -m.valor
    g.n++
  }
  const entradas = [...inMap.values()].sort((a, b) => b.in - a.in)
  const salidas = [...outMap.values()].sort((a, b) => b.out - a.out)

  const totIn = entradas.reduce((s, e) => s + e.in, 0)
  const totOut = salidas.reduce((s, e) => s + e.out, 0)

  // ── Consola ──
  console.log(`Período: ${desde} a ${hasta}`)
  if (resumen) {
    console.log(`Saldo inicial : ${COP(resumen.saldoAnterior)}`)
    console.log(`Total abonos  : ${COP(resumen.totalAbonos)}`)
    console.log(`Total cargos  : ${COP(resumen.totalCargos)}`)
    console.log(`Saldo final   : ${COP(resumen.saldoActual)}`)
    console.log(`Cambio del mes: ${COP(resumen.saldoActual - resumen.saldoAnterior)}\n`)
  }
  console.log('SALIDAS consolidadas (top):')
  for (const e of salidas.slice(0, 20)) console.log(`  ${COP(e.out).padStart(16)}  ${String(e.n).padStart(3)}  ${e.benef}`)
  console.log(`\n  Suma salidas: ${COP(totOut)}  ·  Suma entradas: ${COP(totIn)}`)

  // ── Excel ──
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BusinessHub'

  // Hoja Resumen
  const ws = wb.addWorksheet('Resumen banco', { views: [{ showGridLines: false }] })
  ws.columns = [{ width: 44 }, { width: 22 }]
  let r = 1
  const put = (a, b, opts = {}) => {
    const c1 = ws.getCell(r, 1), c2 = ws.getCell(r, 2)
    c1.value = a; if (b != null) { c2.value = b; c2.numFmt = opts.money === false ? undefined : '"$"#,##0'; c2.alignment = { horizontal: 'right' } }
    if (opts.title) c1.font = { size: 15, bold: true, color: { argb: GRAPHITE } }
    if (opts.bold) [c1, c2].forEach((c) => (c.font = { bold: true }))
    if (opts.head) [c1, c2].forEach((c) => { c.font = { bold: true, color: { argb: GRAPHITE } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } })
    if (opts.pos) c2.font = { bold: true, color: { argb: 'FF166534' } }
    if (opts.neg) c2.font = { bold: true, color: { argb: 'FF991B1B' } }
    r++
  }
  put(`Extracto bancario — ${label}`, null, { title: true })
  put(`Período: ${desde} a ${hasta}`, null); ws.getCell(r - 1, 1).font = { size: 10, color: { argb: 'FF6B7280' } }
  r++
  put('MOVIMIENTO DE CAJA', null, { head: true })
  if (resumen) {
    put('Saldo inicial (31 may)', resumen.saldoAnterior)
    put('Total entradas (abonos)', resumen.totalAbonos, { pos: true })
    put('Total salidas (cargos)', -resumen.totalCargos, { neg: true })
    put('Saldo final (30 jun)', resumen.saldoActual, { bold: true })
    put('Cambio del mes', resumen.saldoActual - resumen.saldoAnterior, (resumen.saldoActual - resumen.saldoAnterior) >= 0 ? { pos: true } : { neg: true })
  }
  r++
  put('EN QUÉ SE VA (conceptos clave)', null, { head: true })
  const pick = (re) => salidas.filter((e) => re.test(e.benef)).reduce((s, e) => s + e.out, 0)
  put('Transferencias (sin beneficiario)', pick(/sin beneficiario/i), { neg: true })
  put('DIAN (impoconsumo/IVA/retención)', pick(/DIAN/))
  put('ICA / Distrito', pick(/ICA/))
  put('Facebook / Meta (publicidad)', pick(/Facebook/))
  put('Google', pick(/Google/))
  put('Proveedores identificados (Comapan, PriceSmart, etc.)', salidas.filter(e=>/comapan|pricesmart|carulla|supertiend|comol|dollarcity|postre|estacio|pintura|ganso|pallomaro/i.test(e.benef)).reduce((s,e)=>s+e.out,0))
  put('Costos bancarios + GMF 4x1000', pick(/Costos bancarios|GMF/))
  r++
  put('NOTA', null, { head: true })
  const note = ws.getCell(r, 1)
  note.value = 'Las "Transferencias" son la mayor salida pero el banco NO dice a quién fueron. Para saber el beneficiario (proveedores, nómina, otros locales, el 2º pago DIAN de $29,2M) hay que cruzarlas con la contabilidad — eso ya está en el Excel de Pagos, hoja "Por proveedor" y "Detalle de pagos".'
  note.font = { size: 9, italic: true, color: { argb: 'FF6B7280' } }
  note.alignment = { wrapText: true, vertical: 'top' }
  ws.mergeCells(r, 1, r, 2); ws.getRow(r).height = 60

  // Hojas consolidadas
  addConsolidado(wb, 'Salidas consolidadas', salidas, 'out')
  addConsolidado(wb, 'Entradas consolidadas', entradas, 'in')

  // Hoja movimientos (detalle)
  const wsm = wb.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1 }] })
  wsm.columns = [{ width: 8 }, { width: 40 }, { width: 34 }, { width: 16 }, { width: 16 }]
  ;['Fecha', 'Descripción banco', 'Beneficiario/concepto', 'Entrada', 'Salida'].forEach((h, i) => (wsm.getCell(1, i + 1).value = h))
  styleHeaderRow(wsm, 1, 5)
  let rm = 2
  for (const m of movs) {
    wsm.getCell(rm, 1).value = m.fecha
    wsm.getCell(rm, 2).value = m.desc
    wsm.getCell(rm, 3).value = m.benef
    if (m.valor >= 0) { const c = wsm.getCell(rm, 4); c.value = Math.round(m.valor); c.numFmt = '"$"#,##0' }
    else { const c = wsm.getCell(rm, 5); c.value = Math.round(-m.valor); c.numFmt = '"$"#,##0' }
    rm++
  }
  wsm.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } }

  const outDir = join(homedir(), 'Downloads')
  mkdirSync(outDir, { recursive: true })
  const slug = label.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')
  const xlsxPath = join(outDir, `Consolidado-Banco-${slug}-Junio-2026.xlsx`)
  await wb.xlsx.writeFile(xlsxPath)
  console.log(`\n✓ Excel: ${xlsxPath}`)
}

main().catch((err) => { console.error('ERROR:', err.message); console.error(err.stack); process.exit(1) })
