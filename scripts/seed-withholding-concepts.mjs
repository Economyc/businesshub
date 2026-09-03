#!/usr/bin/env node
// Siembra el catálogo global de conceptos de retención en la fuente
// (colección raíz /withholdingConcepts) que usa Ecore en Cuentas por Pagar.
//
// Es el mismo contenido del botón "Cargar conceptos sugeridos" de
// Ajustes → Retenciones; el script existe porque esa pantalla sólo deja
// escribir a la cuenta propietaria (regla de Firestore), y así se puede
// sembrar sin depender de con qué cuenta esté logueado el navegador.
//
// Idempotente: no duplica un concepto que ya exista con el mismo nombre.
//
// Uso:
//   node scripts/seed-withholding-concepts.mjs          # siembra lo que falte
//   node scripts/seed-withholding-concepts.mjs --list   # sólo lista lo que hay
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))

const PROJECT_ID = 'empresas-bf'
const COLLECTION = 'withholdingConcepts'

// Tarifas 2026 con bases mínimas en pesos (UVT 2026 ≈ $52.374). Son el punto de
// partida: se editan desde Ajustes → Retenciones, que es la fuente de verdad.
// Mantener alineado con WITHHOLDING_SUGGESTED en Ecore src/modules/invoicing/types.ts.
const CONCEPTS = [
  { name: 'Compras generales', rate: 2.5, ivaRate: 19, minBase: 1414000, order: 1 },
  { name: 'Servicios generales (declarantes)', rate: 4, ivaRate: 19, minBase: 209000, order: 2 },
  { name: 'Servicios generales (no declarantes)', rate: 6, ivaRate: 19, minBase: 209000, order: 3 },
  { name: 'Honorarios y consultoría', rate: 11, ivaRate: 19, minBase: 0, order: 4 },
  { name: 'Arrendamiento de bienes muebles', rate: 4, ivaRate: 19, minBase: 0, order: 5 },
  { name: 'Arrendamiento de bienes inmuebles', rate: 3.5, ivaRate: 19, minBase: 1414000, order: 6 },
  { name: 'Transporte de carga', rate: 1, ivaRate: 0, minBase: 209000, order: 7 },
  { name: 'Servicio de restaurante, hotel y hospedaje', rate: 3.5, ivaRate: 8, minBase: 209000, order: 8 },
]

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

const listOnly = process.argv.includes('--list')

const snap = await db.collection(COLLECTION).get()
const existing = new Map(snap.docs.map((d) => [String(d.data().name ?? '').toLowerCase(), d]))

console.log(`Catálogo actual: ${snap.size} concepto(s)`)
for (const d of snap.docs) {
  const c = d.data()
  console.log(`  · ${c.name} — ${c.rate}%${c.active === false ? ' (inactivo)' : ''}`)
}

if (listOnly) process.exit(0)

const now = admin.firestore.Timestamp.now()
const batch = db.batch()
let added = 0

for (const c of CONCEPTS) {
  if (existing.has(c.name.toLowerCase())) continue
  batch.set(db.collection(COLLECTION).doc(), { ...c, active: true, createdAt: now, updatedAt: now })
  added++
}

if (added === 0) {
  console.log('\nNada que sembrar: ya están todos.')
  process.exit(0)
}

await batch.commit()
console.log(`\nSembrados ${added} concepto(s) nuevo(s) en /${COLLECTION}.`)
