#!/usr/bin/env node
// Aplica al cache ya guardado las anulaciones manuales de la lista MANUAL_VOIDS.
//
// Por que existe: el POS deja algunos comprobantes como "Comprobante activo"
// aunque en su propio panel figuren anulados (nota credito emitida y/o pedido
// de delivery cancelado). La API de integracion no expone ninguno de esos dos
// estados, asi que el hub los anula por su cuenta.
//
// El writer del cache ya aplica la lista sobre cada sincronizacion nueva
// (src/modules/pos-sync/utils/manual-voids.ts y functions/src/pos-cache.ts),
// pero los documentos escritos ANTES de agregar una entrada siguen con el
// comprobante activo. Este script los corrige de una vez.
//
// La lista de abajo debe reflejar las otras dos. Al agregar una entrada nueva,
// correr este script para el mes correspondiente.
//
// Uso:
//   node scripts/apply-manual-voids.mjs                    # simula, no escribe
//   node scripts/apply-manual-voids.mjs --apply            # escribe
//
// Autenticacion: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')

const PROJECT_ID = 'empresas-bf'
const SALES_COLLECTION = 'pos-sales-cache'

const MANUAL_VOIDS = [
  {
    localId: 2,
    serie: 'FVBT',
    correlativo: '1797',
    reason:
      'Nota de credito F000-00000008 del 18/08/2026 - motivo "pruebas sistema" - pedido C2-3747 cancelado',
  },
]

const APPLY = process.argv.includes('--apply')

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')

const companies = await db.collection('companies').get()
let found = 0
let written = 0

for (const company of companies.docs) {
  const label = `${company.data().name ?? company.id}${company.data().location ? ' ' + company.data().location : ''}`
  const snap = await company.ref.collection(SALES_COLLECTION).get()

  for (const doc of snap.docs) {
    const ventas = doc.data().ventas
    if (!Array.isArray(ventas)) continue

    let touched = false
    const next = ventas.map((v) => {
      const mv = MANUAL_VOIDS.find(
        (m) =>
          Number(v.id_local) === m.localId &&
          String(v.serie ?? '').trim() === m.serie &&
          String(v.correlativo ?? '').trim() === m.correlativo,
      )
      if (!mv) return v
      found++
      const yaAnulado = String(v.estado_txt ?? '').toLowerCase() === 'comprobante anulado'
      console.log(
        `  ${label} / ${doc.id}: ${v.serie}-${v.correlativo} ${money(v.total)} ` +
          `[${v.estado_txt}]${yaAnulado ? ' -> ya estaba anulado, sin cambios' : ' -> Comprobante anulado'}`,
      )
      if (yaAnulado) return v
      touched = true
      return { ...v, estado: '0', estado_txt: 'Comprobante anulado', hubVoidReason: mv.reason }
    })

    if (touched) {
      if (APPLY) {
        await doc.ref.update({ ventas: next })
        written++
      } else {
        written++
      }
    }
  }
}

console.log('')
console.log(`comprobantes encontrados: ${found}`)
console.log(
  APPLY
    ? `documentos actualizados: ${written}`
    : `documentos que se actualizarian: ${written}  (simulacion: volve a correr con --apply)`,
)
process.exit(0)
