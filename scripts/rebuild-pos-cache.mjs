#!/usr/bin/env node
// Reconstruye el cache de POS sales en Firestore trayendo todo live
// desde el proxy y sobrescribiendo companies/{cid}/pos-sales-cache.
//
// Útil cuando el cache quedó congelado con datos parciales (fuera de
// la ventana de reconcile) y queremos dejar el aplicativo 1:1 con el
// POS de inmediato sin depender de que el usuario recargue 30 veces.
//
// Uso:
//   node scripts/rebuild-pos-cache.mjs --company <id>                  # mes actual
//   node scripts/rebuild-pos-cache.mjs --company <id> --from 2026-04-01 --to 2026-04-30
//   node scripts/rebuild-pos-cache.mjs --company <id> --dry-run         # no escribe
//
// Autenticación: gcloud auth application-default login.

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')

const PROJECT_ID = 'empresas-bf'
const SALES_COLLECTION = 'pos-sales-cache'
const META_COLLECTION = 'pos-sales-cache-meta'
const POS_PROXY_URL = process.env.POS_PROXY_URL || 'https://posproxy-xfyucmyk7q-uc.a.run.app'
const MAX_VENTAS_PER_DOC = 150

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

const companyId = args.company
const dryRun = args['dry-run'] === 'true'

function currentMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  }
}

const mr = currentMonthRange()
const fromDate = args.from || mr.from
const toDate = args.to || mr.to

if (!companyId) {
  console.error('Falta --company <id>')
  console.error('Ejemplo: node scripts/rebuild-pos-cache.mjs --company 36dNFE9OH1ISyGXZ5GKe')
  process.exit(1)
}

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

function enumerateDates(start, end) {
  const dates = []
  const current = new Date(start + 'T12:00:00')
  const endDate = new Date(end + 'T12:00:00')
  while (current <= endDate) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }
  return dates
}

async function fetchLive(localIds, from, to) {
  const f1 = `${from} 00:00:00`
  const f2 = `${to} 23:59:59`
  const res = await fetch(POS_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ventas-batch', params: { local_ids: localIds, f1, f2 } }),
  })
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Proxy error')
  return { ventas: json.data.ventas || [], rateLimited: !!json.data.rateLimited }
}

async function discoverLocalIds() {
  // Deducir locales existentes del cache actual. Si el cache está vacío,
  // el usuario debe pasar --locals 1,2
  if (args.locals) {
    return args.locals.split(',').map((x) => Number(x.trim())).filter(Boolean)
  }
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection(SALES_COLLECTION)
    .limit(200)
    .get()
  const set = new Set()
  for (const d of snap.docs) {
    const data = d.data()
    if (data.localId != null) set.add(Number(data.localId))
    for (const v of data.ventas || []) if (v.id_local != null) set.add(Number(v.id_local))
  }
  return [...set].sort((a, b) => a - b)
}

async function main() {
  console.log(`Proyecto:  ${PROJECT_ID}`)
  console.log(`Empresa:   ${companyId}`)
  console.log(`Rango:     ${fromDate}  →  ${toDate}`)
  console.log(`Dry run:   ${dryRun ? 'sí (no escribe)' : 'no'}`)

  const localIds = await discoverLocalIds()
  if (localIds.length === 0) {
    console.error('No se pudo detectar localIds del cache. Pasa --locals 1,2')
    process.exit(1)
  }
  console.log(`Locales:   ${localIds.join(',')}`)

  console.log('\nTrayendo live del proxy...')
  const { ventas, rateLimited } = await fetchLive(localIds, fromDate, toDate)
  console.log(`Ventas recibidas: ${ventas.length} (rateLimited=${rateLimited})`)

  if (rateLimited) {
    console.error('⚠️  El proxy reportó rate-limit. Reintentar en unos minutos.')
    process.exit(2)
  }

  // Agrupar por (date_localId)
  const groups = new Map()
  for (const v of ventas) {
    const date = (v.fecha || '').slice(0, 10)
    if (!date) continue
    const key = `${date}_${v.id_local}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(v)
  }

  const allDates = enumerateDates(fromDate, toDate)
  console.log(`Días a escribir: ${allDates.length} × ${localIds.length} locales = ${allDates.length * localIds.length} documentos`)

  const metaByMonth = new Map()
  const now = admin.firestore.Timestamp.now()
  let docsWritten = 0
  let docsDeleted = 0

  if (dryRun) {
    console.log('\n[dry-run] Resumen por (fecha, local):')
    for (const date of allDates) {
      for (const lid of localIds) {
        const key = `${date}_${lid}`
        const group = groups.get(key) || []
        console.log(`  ${key}: ${group.length} ventas`)
      }
    }
    return
  }

  // Primero: borrar TODOS los docs existentes de pos-sales-cache cuya `date`
  // esté en el rango — así limpiamos tanto el schema legacy (sin `_pN`) como
  // paginaciones anteriores que podrían tener más páginas que las nuevas.
  console.log('Borrando docs existentes en el rango...')
  const existingSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection(SALES_COLLECTION)
    .where('date', '>=', fromDate)
    .where('date', '<=', toDate)
    .get()
  console.log(`Encontrados ${existingSnap.size} docs legacy para limpiar`)

  // Escribir en batches (500 ops max)
  const BATCH_SIZE = 400
  let batch = db.batch()
  let opsInBatch = 0

  async function commitIfNeeded(force = false) {
    if (opsInBatch === 0) return
    if (force || opsInBatch >= BATCH_SIZE) {
      await batch.commit()
      batch = db.batch()
      opsInBatch = 0
    }
  }

  for (const d of existingSnap.docs) {
    batch.delete(d.ref)
    docsDeleted++
    opsInBatch++
    await commitIfNeeded()
  }

  for (const date of allDates) {
    const month = date.slice(0, 7)
    if (!metaByMonth.has(month)) metaByMonth.set(month, {})
    const monthPayload = metaByMonth.get(month)
    for (const lid of localIds) {
      const key = `${date}_${lid}`
      const group = groups.get(key) || []
      monthPayload[key] = now
      if (group.length > 0) {
        const pages = Math.ceil(group.length / MAX_VENTAS_PER_DOC)
        for (let p = 0; p < pages; p++) {
          const chunk = group.slice(p * MAX_VENTAS_PER_DOC, (p + 1) * MAX_VENTAS_PER_DOC)
          const docId = `${key}_p${p}`
          const docRef = db.collection('companies').doc(companyId).collection(SALES_COLLECTION).doc(docId)
          batch.set(docRef, { date, localId: lid, page: p, pages, ventas: chunk, syncedAt: now })
          docsWritten++
          opsInBatch++
          await commitIfNeeded()
        }
      }
    }
  }

  // Meta
  for (const [month, days] of metaByMonth) {
    const metaRef = db.collection('companies').doc(companyId).collection(META_COLLECTION).doc(month)
    batch.set(metaRef, { month, days }, { merge: true })
    opsInBatch++
    await commitIfNeeded()
  }

  await commitIfNeeded(true)

  console.log(`\n✅ Listo. Escritos ${docsWritten} documentos con ventas. Limpiados ${docsDeleted} días vacíos.`)
  console.log('\nCorre ahora:')
  console.log(`  node scripts/audit-pos-sales.mjs --company ${companyId} --target <posValue>`)
}

main().catch((err) => {
  console.error('ERROR:', err.message || err)
  process.exit(1)
})
