#!/usr/bin/env node
// Diagnóstico de solo lectura: por qué un insumo (default "coca") aparece "Sin stock"
// pese a un conteo. Reproduce la proyección: anchor (último conteo FINAL) + entradas
// − ajustes (sin consumo POS, que requiere cache). Lee de Firestore vía ADC.
//
// Uso:
//   node scripts/diagnose-coca-stock.mjs                      # lista empresas
//   node scripts/diagnose-coca-stock.mjs --company <id>       # diagnostica "coca"
//   node scripts/diagnose-coca-stock.mjs --company <id> --name "coca cola"
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')

const PROJECT_ID = 'empresas-bf'

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

const companyId = args.company
const needle = String(args.name || 'coca').toLowerCase()

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

const fmtD = (ts) => (ts?.toDate ? ts.toDate().toISOString().slice(0, 16).replace('T', ' ') : '—')

async function listCompanies() {
  const snap = await db.collection('companies').get()
  console.log('\nEmpresas:')
  for (const d of snap.docs) console.log(`  ${d.id}  ${d.data().name || '?'}`)
  console.log('\nVolvé a correr con --company <id>')
}

async function sub(col) {
  const snap = await db.collection('companies').doc(companyId).collection(col).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function main() {
  if (!companyId) return listCompanies()

  const [items, counts, recipes, receipts, adjustments] = await Promise.all([
    sub('inventoryItems'),
    sub('inventoryCounts'),
    sub('recipes'),
    sub('inventoryReceipts'),
    sub('inventoryAdjustments'),
  ])

  const matchItems = items.filter((i) => (i.name || '').toLowerCase().includes(needle))
  console.log(`\n=== INSUMOS que matchean "${needle}" (${matchItems.length}) ===`)
  for (const i of matchItems) {
    console.log(
      `  id=${i.id}  "${i.name}"  active=${i.active}  unit=${i.stockUnit}  par=${i.parLevel ?? '—'}  factor=${i.purchaseToStockFactor}`,
    )
  }
  const itemNameById = Object.fromEntries(items.map((i) => [i.id, i.name]))

  const finals = counts.filter((c) => c.status === 'final').sort((a, b) => b.countedAt - a.countedAt)
  const drafts = counts.filter((c) => c.status === 'draft').sort((a, b) => b.countedAt - a.countedAt)
  const lastFinal = finals[0] || null

  console.log(`\n=== CONTEOS (${counts.length}) — finales=${finals.length} borradores=${drafts.length} ===`)
  console.log(`  Último FINAL (ancla): ${lastFinal ? `${lastFinal.id} @ ${fmtD(lastFinal.countedAt)}` : 'NINGUNO'}`)
  for (const dft of drafts.slice(0, 5)) {
    const newer = lastFinal && dft.countedAt > lastFinal.countedAt
    console.log(`  Borrador: ${dft.id} @ ${fmtD(dft.countedAt)} ${newer ? '⚠ MÁS NUEVO que el ancla (no cuenta hasta aprobar)' : ''}`)
  }

  const sinceMs = lastFinal ? lastFinal.countedAt.toMillis() : 0

  console.log(`\n=== PARA CADA INSUMO MATCH: ancla + movimientos ===`)
  for (const it of matchItems) {
    const inAnchor = lastFinal?.lines?.find((l) => l.itemId === it.id)
    const rcpt = receipts
      .filter((r) => r.itemId === it.id && (r.createdAt?.toMillis?.() ?? 0) >= sinceMs)
      .reduce((s, r) => s + (Number(r.qty) || 0) * (Number(it.purchaseToStockFactor) || 1), 0)
    const adj = adjustments
      .filter((a) => a.itemId === it.id && (a.createdAt?.toMillis?.() ?? 0) >= sinceMs)
      .reduce((s, a) => s + (Number(a.qtyDelta) || 0), 0)
    console.log(`\n  "${it.name}" (id=${it.id})`)
    console.log(`    En el conteo ancla: ${inAnchor ? `SÍ, qty=${inAnchor.qty}` : 'NO — arranca en 0 ⚠'}`)
    console.log(`    Entradas desde el ancla (a stock): ${rcpt}`)
    console.log(`    Ajustes/mermas desde el ancla: ${adj}`)
    console.log(`    Proyección sin consumo POS = ${(inAnchor?.qty ?? 0) + rcpt - adj}  (luego se le resta el consumo de ventas)`)
  }

  const prodRecipes = recipes.filter(
    (r) => r.type === 'product' && (r.posProductKey?.name || '').toLowerCase().includes(needle),
  )
  console.log(`\n=== RECETAS de producto que matchean "${needle}" (${prodRecipes.length}) ===`)
  for (const r of prodRecipes) {
    console.log(`  "${r.posProductKey?.name}"  presId=${r.posProductKey?.presentationId}  active=${r.active}  components=${r.components?.length ?? 0}`)
    for (const c of r.components ?? []) {
      const label = c.kind === 'item' ? itemNameById[c.refId] ?? '(insumo desconocido)' : '(preparación)'
      console.log(`     - ${c.kind} refId=${c.refId} qty=${c.qty}  → ${label}`)
    }
  }

  console.log('\nListo.')
}

main().catch((e) => {
  console.error('\nERROR:', e.message)
  if (/credential|auth|permission/i.test(e.message)) {
    console.error('→ Probá: gcloud auth application-default login')
  }
  process.exit(1)
})
