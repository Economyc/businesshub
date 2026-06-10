#!/usr/bin/env node
// Cuenta cuántas ventas (tickets) de Blue Manila fueron en efectivo en un mes.
// Lee companies/{companyId}/pos-sales-cache desde Firestore (ADC, read-only).
// Mira pagosList[].tipoPago de cada venta, excluye anuladas y pagos-propina.
//
// Uso:
//   node scripts/count-cash-sales-blue-manila.mjs              # junio 2026 (default)
//   node scripts/count-cash-sales-blue-manila.mjs --from 2026-06-01 --to 2026-06-30
//   node scripts/count-cash-sales-blue-manila.mjs --company <id>   # forzar company
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')

const PROJECT_ID = 'empresas-bf'
const SALES_COLLECTION = 'pos-sales-cache'

// ───────── CLI args ─────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) {
      const key = cur.slice(2)
      const next = arr[i + 1]
      acc.push([key, next && !next.startsWith('--') ? next : 'true'])
    }
    return acc
  }, [])
)

const fromDate = args.from || '2026-06-01'
const toDate = args.to || '2026-06-30'
const forcedCompany = args.company || null

// ───────── Helpers (mirror de audit-pos-sales.mjs / sales-calculations) ─────────
const num = (v) => Number(v) || 0
const normalize = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const isAnulada = (v) => normalize(v.estado_txt) === 'comprobante anulado'

const isPropinaLike = (tipo) => {
  const t = normalize(tipo)
  return t.includes('propina') || t.includes('tip')
}
const isCash = (tipo) => {
  const t = normalize(tipo)
  return t.includes('efectivo') || t.includes('cash')
}

const COP = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const pad = (s, n) => String(s).padEnd(n)
const padR = (s, n) => String(s).padStart(n)

// ───────── Init ─────────
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
    const name = normalize(data.name)
    const combined = normalize(`${data.name} ${data.location}`)
    if (name.includes('blue')) {
      candidates.push({ id: d.id, name: data.name, location: data.location, posTenantId: data.posTenantId })
    }
    void combined
  }
  console.log('Companies "Blue" encontradas:')
  for (const c of candidates) {
    console.log(`  - id=${pad(c.id, 24)} name="${c.name}" location="${c.location ?? ''}" tenant=${c.posTenantId ?? ''}`)
  }
  // Preferir la que coincide con "manila" en name o location.
  const manila = candidates.find(
    (c) => normalize(c.location).includes('manila') || normalize(c.name).includes('manila')
  )
  return manila || candidates[0] || null
}

async function loadVentas(companyId, from, to) {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection(SALES_COLLECTION)
    .where('date', '>=', from)
    .where('date', '<=', to)
    .get()
  const ventas = []
  const localsSeen = new Set()
  for (const d of snap.docs) {
    const data = d.data()
    if (data.localId != null) localsSeen.add(data.localId)
    if (Array.isArray(data.ventas)) ventas.push(...data.ventas)
  }
  return { ventas, localsSeen: [...localsSeen] }
}

// Clasifica una venta por su tender (excluyendo pagos-propina).
function classify(v) {
  const pagos = Array.isArray(v.pagosList) ? v.pagosList : []
  let cash = 0
  let other = 0
  const methods = new Set()
  let hadTender = false
  for (const p of pagos) {
    const tipo = p.tipoPago ?? p.pagoventa_tipo
    if (isPropinaLike(tipo)) continue // las propinas no definen el método
    const monto = num(p.monto ?? p.pagoventa_monto)
    hadTender = true
    methods.add(normalize(tipo) || '(vacio)')
    if (isCash(tipo)) cash += monto
    else other += monto
  }
  if (!hadTender) {
    // Fallback: tipo_pago a nivel venta
    const tipo = v.tipo_pago
    methods.add(normalize(tipo) || '(vacio)')
    if (isCash(tipo)) cash += num(v.total)
    else other += num(v.total)
  }
  return { cash, other, methods }
}

async function main() {
  console.log(`Proyecto: ${PROJECT_ID}   Rango: ${fromDate} → ${toDate}\n`)
  const company = await findBlueManila()
  if (!company) {
    console.error('No se encontró ninguna company Blue.')
    process.exit(1)
  }
  console.log(`\n→ Usando company: id=${company.id} name="${company.name}" location="${company.location ?? ''}"\n`)

  const { ventas, localsSeen } = await loadVentas(company.id, fromDate, toDate)
  console.log(`Ventas en cache (incluye anuladas): ${ventas.length}   locales en docs: [${localsSeen.join(', ')}]`)

  const valid = ventas.filter((v) => !isAnulada(v))
  const anuladas = ventas.length - valid.length
  console.log(`Anuladas excluidas: ${anuladas}`)
  console.log(`Ventas válidas (tickets): ${valid.length}\n`)

  let cashOnly = 0
  let mixed = 0
  let noCash = 0
  let cashAmount = 0
  const byMethodTickets = new Map() // método → # tickets que lo usaron
  const byMethodAmount = new Map() // método → monto total

  for (const v of valid) {
    const { cash, other, methods } = classify(v)
    cashAmount += cash
    if (cash > 0 && other === 0) cashOnly++
    else if (cash > 0 && other > 0) mixed++
    else noCash++
    for (const m of methods) byMethodTickets.set(m, (byMethodTickets.get(m) || 0) + 1)

    // monto por método (otra vez, para desglose)
    const pagos = Array.isArray(v.pagosList) ? v.pagosList : []
    if (pagos.length === 0) {
      const m = normalize(v.tipo_pago) || '(vacio)'
      byMethodAmount.set(m, (byMethodAmount.get(m) || 0) + num(v.total))
    } else {
      for (const p of pagos) {
        const tipo = p.tipoPago ?? p.pagoventa_tipo
        if (isPropinaLike(tipo)) continue
        const m = normalize(tipo) || '(vacio)'
        byMethodAmount.set(m, (byMethodAmount.get(m) || 0) + num(p.monto ?? p.pagoventa_monto))
      }
    }
  }

  const cashTickets = cashOnly + mixed
  const pct = (n) => (valid.length > 0 ? ((n / valid.length) * 100).toFixed(1) + '%' : '—')

  console.log('━'.repeat(60))
  console.log('  RESPUESTA — ventas en EFECTIVO')
  console.log('━'.repeat(60))
  console.log(`  Tickets con efectivo (solo + mixto): ${cashTickets} de ${valid.length}  (${pct(cashTickets)})`)
  console.log(`    · 100% efectivo:  ${cashOnly}  (${pct(cashOnly)})`)
  console.log(`    · efectivo mixto: ${mixed}  (${pct(mixed)})`)
  console.log(`    · sin efectivo:   ${noCash}  (${pct(noCash)})`)
  console.log(`  Monto cobrado en efectivo: ${COP(cashAmount)}`)
  console.log('')

  console.log('Desglose por método (tickets que usaron el método / monto):')
  const rows = [...byMethodAmount.entries()].sort((a, b) => b[1] - a[1])
  console.log('  ' + pad('Método', 24) + padR('#tickets', 10) + padR('Monto', 18))
  console.log('  ' + '─'.repeat(50))
  for (const [m, amt] of rows) {
    console.log('  ' + pad(m, 24) + padR(byMethodTickets.get(m) || 0, 10) + padR(COP(amt), 18))
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  if (err.code === 16 || /UNAUTHENTICATED/i.test(err.message || '')) {
    console.error('\nAutenticación fallida. Corre: gcloud auth application-default login')
  }
  process.exit(1)
})
