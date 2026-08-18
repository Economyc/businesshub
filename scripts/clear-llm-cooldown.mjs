#!/usr/bin/env node
// Limpia los cooldowns que el LLMRouter persiste en Firestore cuando un
// proveedor de IA falla (sin saldo, 429, modelo retirado). Mientras el doc
// exista con `until` en el futuro, el router SALTA ese proveedor aunque el
// problema de fondo ya esté resuelto — por ejemplo tras recargar el saldo.
//
// Ruta: system/llm-rate-limits/providers/{provider}
// Las reglas de Firestore bloquean esa ruta al cliente (allow read, write: if
// false), por eso hace falta este script con credenciales de admin.
//
// Uso:
//   node scripts/clear-llm-cooldown.mjs              # muestra el estado, no borra
//   node scripts/clear-llm-cooldown.mjs gemini       # borra el cooldown de gemini
//   node scripts/clear-llm-cooldown.mjs --all        # borra todos
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))

const PROJECT_ID = 'empresas-bf'

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

const args = process.argv.slice(2)
const all = args.includes('--all')
const targets = args.filter((a) => !a.startsWith('--'))

const col = db.collection('system').doc('llm-rate-limits').collection('providers')
const snap = await col.get()

if (snap.empty) {
  console.log('No hay cooldowns registrados: todos los proveedores están habilitados.')
  process.exit(0)
}

const now = Date.now()
console.log('Estado actual:\n')
for (const doc of snap.docs) {
  const d = doc.data()
  const until = d.until?.toMillis?.() ?? 0
  const activo = until > now
  const restante = activo ? `${Math.round((until - now) / 60000)} min restantes` : 'expirado'
  console.log(
    `  ${doc.id.padEnd(18)} ${activo ? 'BLOQUEADO' : 'libre    '}  ${restante}` +
      (d.reason ? `  (${d.reason})` : ''),
  )
}

const aBorrar = all ? snap.docs.map((d) => d.id) : targets
if (aBorrar.length === 0) {
  console.log('\nNada que borrar. Pasa un proveedor por argumento o usa --all.')
  process.exit(0)
}

console.log('')
for (const id of aBorrar) {
  if (!snap.docs.some((d) => d.id === id)) {
    console.log(`  ${id}: no tenía cooldown, nada que hacer`)
    continue
  }
  await col.doc(id).delete()
  console.log(`  ${id}: cooldown borrado`)
}

console.log('\nListo. El router vuelve a intentar esos proveedores en la próxima llamada')
console.log('(hay un cache en memoria de 30 s por instancia).')
