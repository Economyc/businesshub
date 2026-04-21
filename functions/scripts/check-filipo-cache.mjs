import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ credential: applicationDefault(), projectId: 'empresas-bf' })
const db = getFirestore()

const companyId = 'C06xQypKRqtVenO4ZLfy' // Filipo Belen

const salesSnap = await db.collection('companies').doc(companyId).collection('pos-sales-cache').limit(5).get()
console.log(`pos-sales-cache docs: ${salesSnap.size}`)
salesSnap.docs.forEach((d) => {
  const data = d.data()
  console.log(`  ${d.id} date=${data.date} localId=${data.localId} ventas=${(data.ventas ?? []).length}`)
})

const metaSnap = await db.collection('companies').doc(companyId).collection('pos-sales-meta').get()
console.log(`pos-sales-meta docs: ${metaSnap.size}`)
metaSnap.docs.forEach((d) => {
  const data = d.data()
  const daysKeys = Object.keys(data.days ?? {})
  console.log(`  ${d.id} days=${daysKeys.length}`)
})

const rmRef = db.collection('companies').doc(companyId).collection('settings').doc('pos-reconcile-meta')
const rmSnap = await rmRef.get()
console.log(`reconcile-meta: ${rmSnap.exists ? JSON.stringify(rmSnap.data()) : 'none'}`)

process.exit(0)
