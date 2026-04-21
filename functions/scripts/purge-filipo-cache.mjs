// Purga completa del cache POS de Filipo Belen — data contaminada con ventas
// de Blue desde antes del deploy multi-tenant. Tras correr esto, el cron
// nightly (o un reconcileOnDemand manual) rehidrata con datos del POS
// correcto de Filipo.
//
// Uso:
//   node scripts/purge-filipo-cache.mjs          # DRY RUN
//   node scripts/purge-filipo-cache.mjs --write  # borra

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ credential: applicationDefault(), projectId: 'empresas-bf' })
const db = getFirestore()

const companyId = 'C06xQypKRqtVenO4ZLfy' // Filipo Belen
const DRY = !process.argv.includes('--write')

async function collectionSize(path) {
  const snap = await db.collection(path).get()
  return { size: snap.size, docs: snap.docs }
}

async function deleteAllInBatches(docs) {
  const BATCH = 450
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = db.batch()
    for (const d of docs.slice(i, i + BATCH)) batch.delete(d.ref)
    await batch.commit()
  }
}

const targets = [
  `companies/${companyId}/pos-sales-cache`,
  `companies/${companyId}/pos-sales-meta`,
  `companies/${companyId}/pos-catalog-cache`,
]

for (const path of targets) {
  const { size, docs } = await collectionSize(path)
  console.log(`[purge] ${path} — ${size} docs`)
  if (size === 0) continue
  if (DRY) {
    console.log(`[purge] DRY — no se borran`)
  } else {
    await deleteAllInBatches(docs)
    console.log(`[purge] WRITE — borrados ${size} docs`)
  }
}

// Reconcile-meta: reset flag inProgress si quedó stuck
const rmRef = db.collection(`companies/${companyId}/settings`).doc('pos-reconcile-meta')
const rmSnap = await rmRef.get()
if (rmSnap.exists) {
  console.log(`[purge] reconcile-meta existe: ${JSON.stringify(rmSnap.data())}`)
  if (!DRY) {
    await rmRef.delete()
    console.log(`[purge] WRITE — reconcile-meta borrado (el próximo fetch parte limpio)`)
  }
}

console.log(`[purge] done dry=${DRY}`)
process.exit(0)
