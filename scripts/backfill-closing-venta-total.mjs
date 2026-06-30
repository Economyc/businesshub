#!/usr/bin/env node
// Recalcula el campo `ventaTotal` de cada cierre con la fórmula canónica:
//   ventaTotal = QR + Datáfono + Rappi + max(Efectivo - Apertura, 0)
// Antes Rappi no se sumaba; este backfill corrige el histórico para que Home,
// Acumulado, historial y el ícono de cuadre queden consistentes.
//
// Lee/escribe companies/{companyId}/closings desde Firestore (ADC).
//
// Uso:
//   node scripts/backfill-closing-venta-total.mjs            # DRY-RUN (no escribe)
//   node scripts/backfill-closing-venta-total.mjs --apply    # aplica los cambios
//   node scripts/backfill-closing-venta-total.mjs --apply --company <id>
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')

const PROJECT_ID = 'empresas-bf'
const CLOSINGS_COLLECTION = 'closings'

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

const apply = args.apply === 'true'
const forcedCompany = args.company || null

const num = (v) => Number(v) || 0
const COP = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')

function computeVentaTotal(c) {
  return num(c.qr) + num(c.datafono) + num(c.rappiVentas) + Math.max(num(c.efectivo) - num(c.ap), 0)
}

// ───────── Init ─────────
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

async function listCompanies() {
  if (forcedCompany) {
    const doc = await db.collection('companies').doc(forcedCompany).get()
    return [{ id: doc.id, name: doc.data()?.name ?? forcedCompany }]
  }
  const snap = await db.collection('companies').get()
  return snap.docs.map((d) => ({ id: d.id, name: d.data()?.name ?? d.id }))
}

async function main() {
  console.log(`Proyecto: ${PROJECT_ID}   Modo: ${apply ? 'APLICAR' : 'DRY-RUN (sin escribir)'}\n`)
  const companies = await listCompanies()

  let totalReviewed = 0
  let totalFixed = 0

  for (const company of companies) {
    const snap = await db
      .collection('companies')
      .doc(company.id)
      .collection(CLOSINGS_COLLECTION)
      .get()
    if (snap.empty) continue

    const toFix = []
    for (const d of snap.docs) {
      const data = d.data()
      const stored = num(data.ventaTotal)
      const correct = computeVentaTotal(data)
      totalReviewed++
      if (Math.abs(stored - correct) >= 1) {
        toFix.push({ ref: d.ref, date: data.date, stored, correct, rappi: num(data.rappiVentas) })
      }
    }

    if (toFix.length === 0) continue

    console.log(`■ ${company.name} (${company.id}) — ${toFix.length} a corregir:`)
    for (const f of toFix) {
      console.log(`    ${f.date}  ${COP(f.stored)} → ${COP(f.correct)}  (rappi ${COP(f.rappi)})`)
    }

    if (apply) {
      let batch = db.batch()
      let n = 0
      for (const f of toFix) {
        batch.update(f.ref, { ventaTotal: f.correct, updatedAt: admin.firestore.Timestamp.now() })
        n++
        if (n % 400 === 0) {
          await batch.commit()
          batch = db.batch()
        }
      }
      if (n % 400 !== 0) await batch.commit()
    }

    totalFixed += toFix.length
  }

  console.log('\n' + '─'.repeat(50))
  console.log(`Revisados: ${totalReviewed}   A corregir: ${totalFixed}`)
  if (!apply && totalFixed > 0) {
    console.log('\nDRY-RUN. Para aplicar:  node scripts/backfill-closing-venta-total.mjs --apply')
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  if (err.code === 16 || /UNAUTHENTICATED/i.test(err.message || '')) {
    console.error('\nAutenticación fallida. Corre: gcloud auth application-default login')
  }
  process.exit(1)
})
