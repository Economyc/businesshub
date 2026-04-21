// One-shot: marca cada company con `posTenantId` ('blue' | 'filipo') según
// name+location. Corre con Application Default Credentials (gcloud auth
// application-default login).
//
// Uso:
//   node scripts/migrate-pos-tenants.mjs          # DRY RUN (no escribe)
//   node scripts/migrate-pos-tenants.mjs --write  # aplica cambios
//
// Safe de re-correr: solo toca docs cuyo posTenantId actual difiere del
// objetivo.

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({
  credential: applicationDefault(),
  projectId: 'empresas-bf',
})

const db = getFirestore()

// Reglas: el nombre matchea por *contiene* (tokens de marca) y la location
// debe ser exacta (después de normalizar). Dejar companies sin POS activo
// (ej. Filipo San Lucas por ahora) fuera de las reglas → el script las
// omite con SKIP y sus docs quedan sin posTenantId, lo que es correcto.
const TENANT_RULES = [
  { brand: 'blue', locNorm: 'manila', tenantId: 'blue' },
  { brand: 'blue', locNorm: 'escondite', tenantId: 'blue' },
  { brand: 'filipo', locNorm: 'belen', tenantId: 'filipo' },
]

function norm(s) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function matchRule(nameN, locN) {
  return TENANT_RULES.find((r) => nameN.includes(r.brand) && locN === r.locNorm)
}

const DRY = !process.argv.includes('--write')

const snap = await db.collection('companies').get()
console.log(`[migrate] encontradas=${snap.size} dry=${DRY}`)

let wouldWrite = 0
let alreadyOk = 0
let noRule = 0

for (const doc of snap.docs) {
  const data = doc.data()
  const nameN = norm(data.name)
  const locN = norm(data.location)
  const rule = matchRule(nameN, locN)
  if (!rule) {
    console.log(
      `[migrate] SKIP  id=${doc.id} name="${data.name}" location="${data.location}" — sin regla`,
    )
    noRule++
    continue
  }
  const current = data.posTenantId
  if (current === rule.tenantId) {
    console.log(
      `[migrate] OK    id=${doc.id} name="${data.name}" location="${data.location}" posTenantId="${current}" (sin cambios)`,
    )
    alreadyOk++
    continue
  }
  if (DRY) {
    console.log(
      `[migrate] DRY   id=${doc.id} name="${data.name}" location="${data.location}" → posTenantId="${rule.tenantId}" (actual=${JSON.stringify(current)})`,
    )
  } else {
    await doc.ref.update({ posTenantId: rule.tenantId })
    console.log(
      `[migrate] WRITE id=${doc.id} name="${data.name}" location="${data.location}" → posTenantId="${rule.tenantId}"`,
    )
  }
  wouldWrite++
}

console.log(
  `[migrate] done — writes=${wouldWrite} alreadyOk=${alreadyOk} sinRegla=${noRule} dry=${DRY}`,
)
process.exit(0)
