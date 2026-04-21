import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ credential: applicationDefault(), projectId: 'empresas-bf' })
const db = getFirestore()

const companyId = 'C06xQypKRqtVenO4ZLfy'

const snap = await db.collection('companies').doc(companyId).collection('pos-sales-cache').get()
console.log(`Total docs: ${snap.size}`)

const byDoc = new Map() // docId -> count
const byLocal = new Map() // localId -> count
const byDate = new Map() // date -> count
const allVentaIds = []
const duplicateIds = new Map() // venta ID -> count
let totalSum = 0

for (const d of snap.docs) {
  const data = d.data()
  const ventas = data.ventas ?? []
  byDoc.set(d.id, ventas.length)
  byLocal.set(data.localId, (byLocal.get(data.localId) ?? 0) + ventas.length)
  byDate.set(data.date, (byDate.get(data.date) ?? 0) + ventas.length)
  for (const v of ventas) {
    const id = String(v.ID ?? v.id ?? '')
    allVentaIds.push(id)
    duplicateIds.set(id, (duplicateIds.get(id) ?? 0) + 1)
    totalSum += Number(v.total ?? 0)
  }
}

const uniqueVentas = new Set(allVentaIds).size
const dupes = [...duplicateIds.entries()].filter(([, c]) => c > 1)

console.log(`\nVentas totales (contando duplicados): ${allVentaIds.length}`)
console.log(`Ventas únicas (por ID): ${uniqueVentas}`)
console.log(`Ventas duplicadas: ${dupes.length}`)
console.log(`Suma total (con duplicados): ${totalSum.toLocaleString('es-CO')}`)

console.log(`\nPor localId:`)
for (const [lid, c] of byLocal.entries()) console.log(`  local=${lid} ventas=${c}`)

console.log(`\nPrimeros 5 duplicados:`)
for (const [id, count] of dupes.slice(0, 5)) console.log(`  venta=${id} aparece ${count} veces`)

console.log(`\nDocs por fecha (top 10 con más ventas):`)
const sortedDates = [...byDate.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
for (const [date, c] of sortedDates) console.log(`  ${date}: ${c} ventas`)

process.exit(0)
