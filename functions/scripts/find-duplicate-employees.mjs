/**
 * Detecta personas con ficha DUPLICADA entre sedes.
 *
 * Contexto: en Ecore un empleado vive en `companies/{id}/employees`. Antes de
 * los empleados compartidos, alguien que trabajaba en dos locales se creaba dos
 * veces, con doc ids distintos. Ahora una persona compartida se replica con el
 * MISMO doc id, así que:
 *
 *   · misma cédula + MISMO doc id en varias sedes → ya está vinculada, OK.
 *   · misma cédula + doc ids DISTINTOS            → duplicado a unificar.
 *
 * SOLO LECTURA. No escribe nada. Para unificar, ver merge-duplicate-employees.mjs
 *
 * Prereq: gcloud auth application-default login
 * Uso:    node functions/scripts/find-duplicate-employees.mjs [--json]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ credential: applicationDefault(), projectId: 'empresas-bf' })
const db = getFirestore()

const AS_JSON = process.argv.includes('--json')

/** Cédulas con puntos, espacios o guiones son la misma persona. */
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

  // Todas las fichas de todas las sedes, agrupadas por cédula.
  const byCedula = new Map()
  for (const c of companies) {
    const snap = await db.collection(`companies/${c.id}/employees`).get()
    for (const doc of snap.docs) {
      const e = doc.data()
      const key = normalizeId(e.identification)
      if (!key) continue // sin cédula no se puede afirmar que sea la misma persona
      const entry = {
        companyId: c.id,
        companyLabel: c.label,
        docId: doc.id,
        name: fullName(e),
        identification: e.identification,
        status: e.status ?? '(ausente)',
        position: e.employment?.position ?? e.position ?? '',
        salary: e.employment?.salary ?? null,
        companyIds: e.companyIds ?? null,
        primaryCompanyId: e.primaryCompanyId ?? null,
        updatedAt: e.updatedAt?.toDate?.()?.toISOString() ?? null,
        richness: [
          e.firstName, e.lastName, e.birthDate, e.phone, e.email, e.address,
          e.bankAccount?.accountNumber, e.employment?.salary, e.employment?.hireDate,
          e.socialSecurity?.eps?.name, e.socialSecurity?.arl?.name,
        ].filter(Boolean).length,
      }
      const list = byCedula.get(key)
      if (list) list.push(entry)
      else byCedula.set(key, [entry])
    }
  }

  // Duplicado = la misma cédula con MÁS DE UN doc id distinto.
  const groups = []
  for (const [cedula, fichas] of byCedula) {
    const ids = new Set(fichas.map((f) => f.docId))
    if (ids.size > 1) groups.push({ cedula, fichas })
  }

  // Cuánto "pesa" cada ficha: transacciones y turnos que la referencian.
  for (const g of groups) {
    for (const f of g.fichas) {
      const txSnap = await db
        .collection(`companies/${f.companyId}/transactions`)
        .where('payeeRef.id', '==', f.docId)
        .get()
      f.transacciones = txSnap.size
      f.montoTotal = txSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0)
      f.tipos = [...new Set(txSnap.docs.map((d) => d.data().documentKind ?? 'otro'))].sort()

      let shifts = 0
      for (const col of ['shifts', 'novelties']) {
        const s = await db
          .collection(`companies/${f.companyId}/${col}`)
          .where('employeeId', '==', f.docId)
          .get()
        shifts += s.size
      }
      f.turnos = shifts
    }
    // Canónica sugerida: la que más plata tiene registrada; a igualdad, la más
    // completa. Es la que menos referencias hay que reescribir.
    g.fichas.sort((a, b) => b.montoTotal - a.montoTotal || b.richness - a.richness)
    g.sugerida = g.fichas[0].docId
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ companies, groups }, null, 2))
    return
  }

  console.log(`\nCompañías: ${companies.length}`)
  for (const c of companies) console.log(`  · ${c.label} (${c.id})`)

  if (groups.length === 0) {
    console.log('\nNo hay empleados duplicados entre sedes.\n')
    return
  }

  console.log(`\n${groups.length} persona(s) con ficha duplicada:\n`)
  for (const g of groups) {
    console.log('─'.repeat(78))
    console.log(`Cédula ${g.fichas[0].identification} — ${g.fichas[0].name}`)
    for (const f of g.fichas) {
      const marca = f.docId === g.sugerida ? '★ CANÓNICA' : '  duplicada'
      console.log(`  ${marca}  ${f.companyLabel}`)
      console.log(`     docId=${f.docId}  estado=${f.status}  cargo=${f.position || '—'}`)
      console.log(
        `     ${f.transacciones} transacc. ($${f.montoTotal.toLocaleString('es-CO')})` +
          `${f.tipos.length ? ` [${f.tipos.join(', ')}]` : ''}  ·  ${f.turnos} turnos/novedades` +
          `  ·  ${f.richness} campos con dato`,
      )
    }
  }
  console.log('─'.repeat(78))
  const aReescribir = groups.reduce(
    (s, g) => s + g.fichas.filter((f) => f.docId !== g.sugerida).reduce((x, f) => x + f.transacciones + f.turnos, 0),
    0,
  )
  console.log(`\nReferencias a reapuntar si se unifica con la canónica sugerida: ${aReescribir}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
