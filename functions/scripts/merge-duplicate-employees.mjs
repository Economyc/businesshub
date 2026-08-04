/**
 * Unifica personas con ficha DUPLICADA entre sedes (doc ids distintos).
 *
 * Deja UNA sola identidad: el doc id de la ficha canónica pasa a existir en
 * todas las sedes donde la persona estaba duplicada, y las referencias de esas
 * sedes (transacciones, turnos, novedades) se reapuntan a ese id. La presencia
 * en cada sede se conserva — no se borra a nadie de un local donde trabajó.
 *
 * Qué se conserva de la ficha vieja de cada sede secundaria:
 *   · `status`      — puede estar retirado ahí y activo en la principal.
 *   · `employment`  — cargo/salario/fechas son de la relación con ESE local.
 *   · `documents`   — los adjuntos que se subieron en esa sede.
 * El resto (datos de la persona) viene de la ficha canónica.
 *
 * La sede secundaria queda `payrollPresence: 'rotating'`: no sale por defecto
 * en sus quincenas, se agrega desde la card la quincena que trabajó ahí.
 *
 * DRY-RUN por defecto. Con --apply escribe. Idempotente: si ya se corrió, el
 * detector no vuelve a listar el grupo.
 *
 * Prereq: gcloud auth application-default login
 * Uso:    node functions/scripts/merge-duplicate-employees.mjs [--apply]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp({ credential: applicationDefault(), projectId: 'empresas-bf' })
const db = getFirestore()

const APPLY = process.argv.includes('--apply')

/** Presencia de la sede secundaria tras unificar. Ver cabecera. */
const SECONDARY_PRESENCE = 'rotating'

function normalizeId(v) {
  return String(v ?? '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase()
}

function fullName(e) {
  const rich = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()
  return rich || e.name || '(sin nombre)'
}

async function main() {
  const companiesSnap = await db.collection('companies').get()
  const companies = companiesSnap.docs.map((d) => ({
    id: d.id,
    label: [d.data().name, d.data().location].filter(Boolean).join(' · '),
  }))
  const labelOf = Object.fromEntries(companies.map((c) => [c.id, c.label]))

  // 1. Agrupar todas las fichas por cédula.
  const byCedula = new Map()
  for (const c of companies) {
    const snap = await db.collection(`companies/${c.id}/employees`).get()
    for (const doc of snap.docs) {
      const data = doc.data()
      const key = normalizeId(data.identification)
      if (!key) continue
      const entry = { companyId: c.id, docId: doc.id, data }
      const list = byCedula.get(key)
      if (list) list.push(entry)
      else byCedula.set(key, [entry])
    }
  }

  // 2. Duplicado = misma cédula con más de un doc id distinto.
  const groups = []
  for (const [, fichas] of byCedula) {
    if (new Set(fichas.map((f) => f.docId)).size > 1) groups.push(fichas)
  }

  if (groups.length === 0) {
    console.log('\nNo hay duplicados que unificar.\n')
    return
  }

  console.log(`\n${APPLY ? '=== APLICANDO ===' : '=== DRY-RUN (usa --apply para escribir) ==='}\n`)

  for (const fichas of groups) {
    // 3. Canónica: la que más plata tiene registrada (menos referencias que mover).
    for (const f of fichas) {
      const tx = await db
        .collection(`companies/${f.companyId}/transactions`)
        .where('payeeRef.id', '==', f.docId)
        .get()
      f.monto = tx.docs.reduce((s, d) => s + (d.data().amount || 0), 0)
      f.txCount = tx.size
    }
    fichas.sort((a, b) => b.monto - a.monto)
    const canonica = fichas[0]
    const duplicadas = fichas.slice(1)
    const nombre = fullName(canonica.data)
    const todasLasSedes = [...new Set(fichas.map((f) => f.companyId))]

    console.log('─'.repeat(76))
    console.log(`${nombre} — CC ${canonica.data.identification}`)
    console.log(`  canónica: ${labelOf[canonica.companyId]} (id=${canonica.docId}, ${canonica.txCount} tx)`)

    const batch = db.batch()
    let ops = 0

    for (const dup of duplicadas) {
      const destino = db.doc(`companies/${dup.companyId}/employees/${canonica.docId}`)
      const yaExiste = (await destino.get()).exists
      if (yaExiste) {
        console.log(`  ⚠  ${labelOf[dup.companyId]}: ya hay un doc con el id canónico. Se salta este grupo.`)
        ops = -1
        break
      }

      // Ficha nueva: persona de la canónica + relación laboral de la vieja.
      const merged = {
        ...canonica.data,
        status: dup.data.status ?? canonica.data.status ?? 'active',
        ...(dup.data.employment ? { employment: dup.data.employment } : {}),
        ...(dup.data.documents ? { documents: dup.data.documents } : {}),
        // Campos planos legacy propios de esa sede (App1/talent los renderiza).
        ...(dup.data.department !== undefined ? { department: dup.data.department } : {}),
        ...(dup.data.startDate !== undefined ? { startDate: dup.data.startDate } : {}),
        payrollPresence: SECONDARY_PRESENCE,
        companyIds: todasLasSedes,
        primaryCompanyId: canonica.companyId,
        updatedAt: Timestamp.now(),
      }
      batch.set(destino, merged)
      ops++

      // Reapuntar lo que referencia al id viejo, dentro de esa misma sede.
      let refs = 0
      const txs = await db
        .collection(`companies/${dup.companyId}/transactions`)
        .where('payeeRef.id', '==', dup.docId)
        .get()
      for (const d of txs.docs) {
        batch.update(d.ref, { 'payeeRef.id': canonica.docId })
        ops++; refs++
      }
      for (const col of ['shifts', 'novelties']) {
        const s = await db
          .collection(`companies/${dup.companyId}/${col}`)
          .where('employeeId', '==', dup.docId)
          .get()
        for (const d of s.docs) {
          batch.update(d.ref, { employeeId: canonica.docId })
          ops++; refs++
        }
      }

      batch.delete(db.doc(`companies/${dup.companyId}/employees/${dup.docId}`))
      ops++

      console.log(
        `  unifica: ${labelOf[dup.companyId]} (id=${dup.docId} → ${canonica.docId})` +
          `  ·  ${refs} referencia(s) reapuntada(s)  ·  estado ${merged.status}, ${SECONDARY_PRESENCE}`,
      )
    }

    if (ops < 0) continue

    // La canónica también debe conocer todas sus sedes.
    batch.update(db.doc(`companies/${canonica.companyId}/employees/${canonica.docId}`), {
      companyIds: todasLasSedes,
      primaryCompanyId: canonica.companyId,
      payrollPresence: canonica.data.payrollPresence ?? 'fixed',
      updatedAt: Timestamp.now(),
    })
    ops++

    if (APPLY) {
      await batch.commit()
      console.log(`  ✔ aplicado (${ops} escrituras)`)
    } else {
      console.log(`  → ${ops} escrituras pendientes`)
    }
  }

  console.log('─'.repeat(76))
  console.log(APPLY ? '\nListo.\n' : '\nDry-run. Volvé a correr con --apply para escribir.\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
