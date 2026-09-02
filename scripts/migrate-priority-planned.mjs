#!/usr/bin/env node
// Migración de una sola pasada: las deudas pendientes marcadas "para pagar"
// (verde) pasan de priority='immediate' a priority='planned'.
//
// Contexto: la marca verde del menú de la fila en Cuentas por pagar (Ecore) se
// guardaba en priority='immediate', que es justo el valor que el bot de Telegram
// imprime como URGENTE y la hoja contable de Drive vuelca como "Inmediato". Al
// agregar la marca roja "Marcar urgente", 'immediate' recupera esa semántica y
// el verde se muda a 'planned'. Sin esta migración, todo lo que quedó verde
// aparecería en rojo.
//
// Sólo toca deudas de egreso NO pagadas. En las pagadas, 'immediate' es
// histórico y su "Inmediato" en las hojas de meses ya cerrados es correcto.
//
// OJO: escribir en transactions dispara markSheetJobDirty, así que las hojas de
// Drive de los meses afectados se regeneran y esas facturas pasan de "Inmediato"
// a "Espera" en la columna prioridad. Es el resultado buscado.
//
// Uso:
//   node scripts/migrate-priority-planned.mjs           (dry-run, no escribe)
//   node scripts/migrate-priority-planned.mjs --apply
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))

const PROJECT_ID = 'empresas-bf'
const APPLY = process.argv.includes('--apply')
const BATCH_SIZE = 400

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

const money = (n) => (n ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })
const day = (ts) => (ts?.toDate ? ts.toDate().toISOString().slice(0, 10) : '—')

const companies = await db.collection('companies').get()
const targets = []

for (const company of companies.docs) {
  const name = company.data().name ?? company.id
  // Una sola igualdad: no necesita índice compuesto. El resto se filtra acá.
  const snap = await company.ref
    .collection('transactions')
    .where('priority', '==', 'immediate')
    .get()

  const pending = snap.docs.filter((d) => {
    const t = d.data()
    return t.type === 'expense' && t.status !== 'paid'
  })

  // Desglose de lo descartado, para que un "0 por migrar" se pueda auditar en
  // vez de tener que confiar en él.
  const skipped = {}
  for (const d of snap.docs) {
    const t = d.data()
    if (t.type === 'expense' && t.status !== 'paid') continue
    const key = `${t.type ?? '?'}/${t.status ?? '?'}`
    skipped[key] = (skipped[key] ?? 0) + 1
  }
  const detail = Object.entries(skipped).map(([k, n]) => `${n} ${k}`).join(', ')

  console.log(
    `\n${name}: ${snap.size} con priority='immediate', ${pending.length} por migrar` +
      (detail ? `  (se saltan ${detail})` : ''),
  )
  if (pending.length === 0) continue

  for (const d of pending) {
    const t = d.data()
    console.log(
      `  ${day(t.date).padEnd(12)} ${(t.payeeRef?.name ?? t.concept ?? '—').slice(0, 38).padEnd(40)}` +
        ` ${(t.docNumber ?? '—').padEnd(14)} $${money(t.amount)}`,
    )
    targets.push(d.ref)
  }
}

console.log(`\n${'─'.repeat(60)}`)
console.log(`Total a migrar a priority='planned': ${targets.length}`)

if (targets.length === 0) {
  console.log('Nada que hacer.')
} else if (!APPLY) {
  console.log("Dry-run: no se escribió nada. Volvé a correr con --apply para aplicarlo.")
} else {
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const ref of targets.slice(i, i + BATCH_SIZE)) {
      batch.update(ref, { priority: 'planned' })
    }
    await batch.commit()
    console.log(`  commit ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length}`)
  }
  console.log('Listo.')
}

process.exit(0)
