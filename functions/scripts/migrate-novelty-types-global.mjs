// Migra el catálogo de tipos de novedad de Horarios a una colección RAÍZ global
// (`/noveltyTypes`), usando como base el catálogo de Blue Smash Burger Manila.
//
// Contexto: antes cada company tenía su propio catálogo bajo
// `companies/{companyId}/noveltyTypes`. Ahora `noveltyTypes` es colección raíz
// compartida (ver src/core/firebase/helpers.ts → ROOT_COLLECTIONS), igual que
// `suppliers`. Este script consolida el catálogo "bueno" (Manila) a la raíz.
//
// Idempotente: escribe con setDoc preservando el id, así que re-correrlo no
// duplica. Las novedades ya aplicadas guardan snapshot de typeName+color, no
// hacen lookup por typeId, así que mover el catálogo no rompe nada.
//
// Uso (desde functions/):
//   node scripts/migrate-novelty-types-global.mjs            # dry-run (solo imprime)
//   node scripts/migrate-novelty-types-global.mjs --apply    # ejecuta las escrituras
//
// Prereq: gcloud auth application-default login

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({
  credential: applicationDefault(),
  projectId: 'empresas-bf',
})

const db = getFirestore()
const APPLY = process.argv.includes('--apply')
const NAME_MATCH = 'manila' // case-insensitive, busca en name + location de la company

async function resolveSourceCompany() {
  const snap = await db.collection('companies').get()
  const all = snap.docs.map((d) => {
    const data = d.data() ?? {}
    return {
      id: d.id,
      name: String(data.name ?? ''),
      location: String(data.location ?? ''),
    }
  })
  const matches = all.filter((c) =>
    `${c.name} ${c.location}`.toLowerCase().includes(NAME_MATCH),
  )

  if (matches.length === 1) return matches[0]

  console.error(
    matches.length === 0
      ? `\nERROR: ninguna company con nombre que contenga "${NAME_MATCH}".`
      : `\nERROR: ${matches.length} companies coinciden con "${NAME_MATCH}" (ambiguo).`,
  )
  console.error('Companies disponibles:')
  for (const c of all) console.error(`  - ${c.id}  →  "${c.name}" (location: "${c.location}")`)
  console.error('\nAjusta NAME_MATCH en el script al nombre exacto y vuelve a correr.\n')
  process.exit(1)
}

async function main() {
  console.log(`\n=== MIGRACIÓN noveltyTypes → raíz global ===`)
  console.log(APPLY ? '>>> MODO APLICAR (escribe en Firestore)\n' : '>>> DRY-RUN (no escribe nada)\n')

  const source = await resolveSourceCompany()
  console.log(`Company origen: ${source.id}  →  "${source.name}" (location: "${source.location}")\n`)

  const srcSnap = await db
    .collection('companies')
    .doc(source.id)
    .collection('noveltyTypes')
    .get()

  if (srcSnap.empty) {
    console.error('ERROR: la company origen no tiene tipos de novedad. Nada que migrar.')
    process.exit(1)
  }

  console.log(`Tipos a migrar (${srcSnap.size}):`)
  const rootCol = db.collection('noveltyTypes')

  for (const doc of srcSnap.docs) {
    const data = doc.data()
    console.log(`  - ${doc.id}  →  name="${data?.name}"  color="${data?.color}"`)
    if (APPLY) {
      // setDoc al mismo id en la raíz: idempotente, conserva createdAt/updatedAt.
      await rootCol.doc(doc.id).set(data, { merge: true })
    }
  }

  // Reporta lo que ya hay en la raíz (para detectar duplicados por nombre si los hubiera).
  const rootSnap = await rootCol.get()
  console.log(`\nTotal en /noveltyTypes raíz ${APPLY ? 'tras migrar' : '(actual, sin tocar)'}: ${rootSnap.size}`)

  console.log(
    APPLY
      ? '\n✅ Migración aplicada.\n'
      : '\nDry-run OK. Re-corré con --apply para escribir.\n',
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('\nFallo inesperado:', err)
  process.exit(1)
})
