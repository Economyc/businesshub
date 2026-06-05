// Migra los lotes de Nómina y Propinas ya registrados para que tengan período
// devengado estructurado (accrualMonth + fortnight) y para sellar accrualDate en
// sus transacciones contables.
//
// Contexto: antes la nómina/propinas se contabilizaban por fecha de pago. Ahora
// se reconocen por su mes devengado (ver src/modules/finance/utils/accrual-period.ts
// y recognitionDate en hooks.ts). Este script infiere el devengo de cada lote
// existente a partir de su periodLabel (p.ej. "Q2 mayo 2026") y, si no es
// parseable, de una heurística sobre la fecha de pago.
//
// Por lote:
//   - payroll-batches/{id} y tip-distributions/{id}: set accrualMonth + fortnight
//     + periodLabel canónico.
//   - transactions con splitGroupId == `${companyId}_payroll_${periodKey}` (o
//     `_tips_`): set accrualDate.
//
// Idempotente: los lotes que ya tienen accrualMonth se saltan. Re-sellar el
// mismo accrualDate en las transacciones es inocuo.
//
// Uso (desde functions/):
//   node scripts/migrate-payroll-accrual.mjs            # dry-run (solo imprime)
//   node scripts/migrate-payroll-accrual.mjs --apply    # ejecuta las escrituras
//
// Prereq: gcloud auth application-default login

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp({
  credential: applicationDefault(),
  projectId: 'empresas-bf',
})

const db = getFirestore()
const APPLY = process.argv.includes('--apply')

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
// Alias que aparecen en colillas/etiquetas y no coinciden con MESES_ES.
const MES_ALIAS = { setiembre: 8 } // índice 0-based

// ── Helpers de devengo (duplicados de utils/accrual-period.ts: functions no
// puede importar src/). Mantener en sync. ──

function accrualDateFrom(accrualMonth, fortnight) {
  const [y, m] = accrualMonth.split('-').map(Number) // m: 1-12
  if (fortnight === 'Q1') return new Date(y, m - 1, 15, 12, 0, 0)
  return new Date(y, m, 0, 12, 0, 0)
}

function accrualLabel(accrualMonth, fortnight) {
  const [y, m] = accrualMonth.split('-').map(Number)
  const mes = MESES_ES[m - 1] ?? ''
  if (fortnight === 'full') return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${y}`
  return `${fortnight} ${mes} ${y}`
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Partes (año, mes 0-based, día) de un Timestamp en hora Bogotá (UTC-5, sin DST). */
function bogotaParts(ts) {
  const d = ts.toDate()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
  return { y: Number(parts.year), m: Number(parts.month) - 1, d: Number(parts.day) }
}

function monthKey(year, monthIdx0) {
  return `${year}-${String(monthIdx0 + 1).padStart(2, '0')}`
}

/**
 * Infiere { accrualMonth, fortnight, source } de un lote.
 * source: 'label' (parseado de periodLabel) | 'heuristica' (derivado de paidDate).
 */
function inferAccrual(periodLabel, paidTs) {
  const norm = normalize(periodLabel)
  const paid = paidTs ? bogotaParts(paidTs) : null

  // Mes por nombre en el label.
  let monthIdx = null
  for (let i = 0; i < MESES_ES.length; i++) {
    if (norm.includes(MESES_ES[i])) {
      monthIdx = i
      break
    }
  }
  if (monthIdx == null) {
    for (const [alias, idx] of Object.entries(MES_ALIAS)) {
      if (norm.includes(alias)) {
        monthIdx = idx
        break
      }
    }
  }

  // Quincena.
  let fortnight = null
  const qm = norm.match(/\bq\s*([12])\b/)
  if (qm) fortnight = `Q${qm[1]}`
  else if (/(mes completo|completo|mensual)/.test(norm)) fortnight = 'full'

  if (monthIdx != null) {
    // Año: del label si está; si no, el año más reciente tal que (año, mes) <= paidDate.
    const ym = norm.match(/\b(20\d{2})\b/)
    let year
    if (ym) year = Number(ym[1])
    else if (paid) year = monthIdx <= paid.m ? paid.y : paid.y - 1
    else year = new Date().getFullYear()
    return {
      accrualMonth: monthKey(year, monthIdx),
      fortnight: fortnight ?? 'Q2',
      source: 'label',
    }
  }

  // Sin mes parseable → heurística por día de pago.
  if (!paid) return null
  if (paid.d <= 5) {
    // Pago a inicios de mes → suele liquidar la Q2 del mes anterior.
    const prev = new Date(paid.y, paid.m - 1, 1)
    return {
      accrualMonth: monthKey(prev.getFullYear(), prev.getMonth()),
      fortnight: 'Q2',
      source: 'heuristica',
    }
  }
  if (paid.d <= 20) {
    return { accrualMonth: monthKey(paid.y, paid.m), fortnight: 'Q1', source: 'heuristica' }
  }
  return { accrualMonth: monthKey(paid.y, paid.m), fortnight: 'Q2', source: 'heuristica' }
}

async function migrateCollection(companyId, collName, prefix) {
  const colRef = db.collection('companies').doc(companyId).collection(collName)
  const snap = await colRef.get()
  let migrated = 0
  let skipped = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data() ?? {}
    if (data.accrualMonth && data.fortnight) {
      skipped += 1
      continue
    }

    const inferred = inferAccrual(data.periodLabel, data.paidDate)
    if (!inferred) {
      console.log(
        `    ⚠ ${collName}/${docSnap.id}: sin periodLabel ni paidDate parseable → NO migrado`,
      )
      continue
    }

    const { accrualMonth, fortnight, source } = inferred
    const label = accrualLabel(accrualMonth, fortnight)
    const accrualTs = Timestamp.fromDate(accrualDateFrom(accrualMonth, fortnight))

    // Transacciones del lote (por splitGroupId = `${companyId}_${prefix}_${periodKey}`).
    const groupId = `${companyId}_${prefix}_${data.periodKey}`
    const txSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('transactions')
      .where('splitGroupId', '==', groupId)
      .get()

    console.log(
      `    ${collName}/${docSnap.id}: "${data.periodLabel ?? '∅'}" → ${accrualMonth} ${fortnight}` +
        ` (${source}) · "${label}" · tx: ${txSnap.size}`,
    )

    if (APPLY) {
      const batch = db.batch()
      batch.set(
        docSnap.ref,
        { accrualMonth, fortnight, periodLabel: label, updatedAt: Timestamp.now() },
        { merge: true },
      )
      for (const tx of txSnap.docs) {
        batch.update(tx.ref, { accrualDate: accrualTs })
      }
      await batch.commit()
    }
    migrated += 1
  }

  return { migrated, skipped, total: snap.size }
}

async function main() {
  console.log('\n=== MIGRACIÓN devengo de Nómina y Propinas ===')
  console.log(APPLY ? '>>> MODO APLICAR (escribe en Firestore)\n' : '>>> DRY-RUN (no escribe nada)\n')

  const companies = await db.collection('companies').get()
  let totalMigrated = 0
  let totalSkipped = 0

  for (const company of companies.docs) {
    const companyId = company.id
    const name = company.data()?.name ?? ''
    console.log(`\n  Company ${companyId} ("${name}")`)

    const payroll = await migrateCollection(companyId, 'payroll-batches', 'payroll')
    const tips = await migrateCollection(companyId, 'tip-distributions', 'tips')

    totalMigrated += payroll.migrated + tips.migrated
    totalSkipped += payroll.skipped + tips.skipped

    if (payroll.total === 0 && tips.total === 0) console.log('    (sin lotes)')
  }

  console.log(
    `\nResumen: ${totalMigrated} lote(s) ${APPLY ? 'migrados' : 'a migrar'}, ` +
      `${totalSkipped} ya tenían devengo (saltados).`,
  )
  console.log(
    APPLY ? '\n✅ Migración aplicada.\n' : '\nDry-run OK. Revisá las inferencias y re-corré con --apply.\n',
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('\nFallo inesperado:', err)
  process.exit(1)
})
