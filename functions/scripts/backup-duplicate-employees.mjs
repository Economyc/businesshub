/**
 * Respaldo previo a merge-duplicate-employees.mjs.
 * Vuelca a JSON los docs de empleado duplicados y TODA referencia que el merge
 * va a reescribir (transacciones, turnos, novedades), con su contenido actual.
 * Solo lectura. Salida: functions/scripts/backup-duplicados-<timestamp>.json
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { writeFileSync } from 'node:fs'

initializeApp({ credential: applicationDefault(), projectId: 'empresas-bf' })
const db = getFirestore()

const normalizeId = (v) => String(v ?? '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase()

const companiesSnap = await db.collection('companies').get()
const companies = companiesSnap.docs.map((d) => ({ id: d.id, name: d.data().name, location: d.data().location }))

const byCedula = new Map()
for (const c of companies) {
  const snap = await db.collection(`companies/${c.id}/employees`).get()
  for (const doc of snap.docs) {
    const key = normalizeId(doc.data().identification)
    if (!key) continue
    const list = byCedula.get(key) ?? []
    list.push({ companyId: c.id, docId: doc.id, data: doc.data() })
    byCedula.set(key, list)
  }
}

const backup = { generadoEn: new Date().toISOString(), companies, grupos: [] }
for (const [cedula, fichas] of byCedula) {
  if (new Set(fichas.map((f) => f.docId)).size < 2) continue
  const grupo = { cedula, fichas: [] }
  for (const f of fichas) {
    const refs = { transactions: [], shifts: [], novelties: [] }
    const tx = await db
      .collection(`companies/${f.companyId}/transactions`)
      .where('payeeRef.id', '==', f.docId)
      .get()
    refs.transactions = tx.docs.map((d) => ({ id: d.id, data: d.data() }))
    for (const col of ['shifts', 'novelties']) {
      const s = await db.collection(`companies/${f.companyId}/${col}`).where('employeeId', '==', f.docId).get()
      refs[col] = s.docs.map((d) => ({ id: d.id, data: d.data() }))
    }
    grupo.fichas.push({ companyId: f.companyId, docId: f.docId, data: f.data, refs })
  }
  backup.grupos.push(grupo)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const out = new URL(`./backup-duplicados-${stamp}.json`, import.meta.url)
writeFileSync(out, JSON.stringify(backup, null, 2))
const total = backup.grupos.reduce(
  (s, g) => s + g.fichas.reduce((x, f) => x + f.refs.transactions.length + f.refs.shifts.length + f.refs.novelties.length, 0),
  0,
)
console.log(`Respaldo: ${backup.grupos.length} grupo(s), ${total} referencia(s).`)
console.log(out.pathname)
