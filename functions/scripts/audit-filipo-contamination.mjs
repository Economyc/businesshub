import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ credential: applicationDefault(), projectId: 'empresas-bf' })
const db = getFirestore()

const filipo = 'C06xQypKRqtVenO4ZLfy'
const blueManila = '36dNFE9OH1ISyGXZ5GKe'

async function idsForDate(companyId, date) {
  const snap = await db
    .collection('companies').doc(companyId)
    .collection('pos-sales-cache')
    .where('date', '==', date)
    .get()
  const ids = new Set()
  for (const d of snap.docs) {
    for (const v of d.data().ventas ?? []) ids.add(String(v.ID))
  }
  return ids
}

for (const date of ['2026-04-11', '2026-04-12', '2026-04-10']) {
  const filipoIds = await idsForDate(filipo, date)
  const blueIds = await idsForDate(blueManila, date)
  const overlap = [...filipoIds].filter((id) => blueIds.has(id))
  console.log(`${date}: filipo=${filipoIds.size} blue_manila=${blueIds.size} overlap=${overlap.length}`)
  if (overlap.length > 0) console.log(`  overlap sample: ${overlap.slice(0, 3).join(',')}`)
}

// Sample IDs in Filipo cache for 04-11 to compare vs what POS actually returned
const snap = await db
  .collection('companies').doc(filipo)
  .collection('pos-sales-cache')
  .where('date', '==', '2026-04-11')
  .get()
const sampleIds = []
for (const d of snap.docs) {
  for (const v of d.data().ventas ?? []) {
    sampleIds.push({ id: v.ID, fecha: v.fecha, total: v.total, id_local: v.id_local })
  }
}
sampleIds.sort((a, b) => Number(a.id) - Number(b.id))
console.log(`\nFilipo cache 04-11 — rango IDs: ${sampleIds[0]?.id} .. ${sampleIds[sampleIds.length - 1]?.id}`)
console.log(`  id_local presentes:`, [...new Set(sampleIds.map((s) => s.id_local))].join(','))
console.log(`  primeros 3:`, sampleIds.slice(0, 3))
console.log(`  últimos 3:`, sampleIds.slice(-3))

process.exit(0)
