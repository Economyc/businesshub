#!/usr/bin/env node
// Carga los socios de cuentas en participación de un local y siembra su primer
// mes de ROI como pendiente.
//
// Por qué a mano: el cron dispatchRoiMonthly copia el mes anterior, pero si la
// company no tiene ningún ROI se sale (snap.empty → return 0). El primer mes de
// un local hay que sembrarlo; de ahí en adelante el cron sigue solo.
//
// Los datos van embebidos abajo a propósito —ya cruzados y validados contra los
// totales de cada archivo—: así el script queda auditable y reproducible sin
// depender de archivos sueltos en Downloads.
//
// Idempotente en las dos etapas: un socio que ya existe se actualiza sin pisar
// datos, y un socio que ya tiene ROI en el mes objetivo no se duplica.
//
// Uso:
//   node scripts/seed-socios-roi.mjs --local belen              # DRY-RUN
//   node scripts/seed-socios-roi.mjs --local belen --apply      # aplica
//   node scripts/seed-socios-roi.mjs --local san-lucas          # ya aplicado
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))

const PROJECT_ID = 'empresas-bf'
const ROI_CATEGORY = 'ROI socios'
const APPLY = process.argv.includes('--apply')

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// `name` es la llave de búsqueda en /partners (colección RAÍZ compartida entre
// locales): los socios que ya existen se reutilizan con el nombre que tienen
// —no se renombran, porque payeeRef.name quedó copiado en el histórico de ROI—.
// `pct` = % de participación en ESE local (solo referencia visual en el
// formulario; el monto es el que manda). `roi` = valor mensual.
// `target` = mes devengado a sembrar (month 0-indexed).
const LOCALES = {
  // ~/Downloads/ROI SAN LUCAS.xlsx + CUENTAS SOCIOS SAN LUCAS.xlsx.
  // Las filas "(GESTOR)" de José Cárdenas (27%) y Felipe Vélez (24%) no se
  // cargan —no tienen capital ni ROI—, así que los pct suman 49, no 100.
  'san-lucas': {
    companyId: 'L3yMbGCeVgL3pQvA1hi4',
    label: 'Filipo San Lucas',
    target: { year: 2026, month: 7 }, // Agosto 2026
    socios: [
      { name: 'Esteban Ortiz',     identification: '1214743300', pct: 3,  roi: 833333,  bankAccount: '26772643003' },
      { name: 'Julian Ortiz',      identification: '1037654844', pct: 2,  roi: 555556,  bankAccount: '37979737921' },
      { name: 'Felipe Sanchez',    identification: '1037663403', pct: 4,  roi: 1000000, bankAccount: '02971603120' },
      { name: 'Jorge Sanchez',     identification: '70568590',   pct: 7,  roi: 1750000, bankAccount: '' },
      { name: 'Sebastian Barrios', identification: '1047501328', pct: 4,  roi: 1000000, bankAccount: '91200255815' },
      { name: 'Jonny Lopez',       identification: '71385705',   pct: 10, roi: 2277778, bankAccount: '36223175575' },
      { name: 'Martin Escobar',    identification: '1037661916', pct: 2,  roi: 555556,  bankAccount: '43607189669' },
      { name: 'Luis Diaz',         identification: '1067965842', pct: 1,  roi: 305556,  bankAccount: '68087142802' },
      { name: 'Victor Diaz',       identification: '1067903881', pct: 1,  roi: 305556,  bankAccount: '69338149654' },
      { name: 'Juan Zabala',       identification: '1152454700', pct: 4,  roi: 1333333, bankAccount: '55147645782' },
      { name: 'Jose Cardenas',     identification: '1047487356', pct: 2,  roi: 555556,  bankAccount: '' },
      { name: 'Felipe Velez',      identification: '1152710460', pct: 4,  roi: 1111111, bankAccount: '' },
      { name: 'Andres Ramirez',    identification: '1037624644', pct: 2,  roi: 555556,  bankAccount: '37955266073' },
      // Socio gestor sin capital: participa en la utilidad pero no recibe ROI.
      { name: 'Daniel Duque',      identification: '',           pct: 3,  roi: 0,       bankAccount: '' },
    ],
  },

  // ~/Downloads/FILIPO - BELEN ROI.xlsx. Los pct vienen tal cual del archivo:
  // suman 95,01 y el de José Cárdenas (31,11) no cuadra con su ROI —recibe lo
  // mismo que Felipe Vélez, que figura con 36,11—. Se deja como está porque el
  // valor que se usa es el monto en pesos. Los Carranza no traen cédula ni
  // cuenta: se crean solo con el nombre.
  belen: {
    companyId: 'C06xQypKRqtVenO4ZLfy',
    label: 'Filipo Belén',
    target: { year: 2026, month: 7 }, // Agosto 2026
    socios: [
      { name: 'Jose Cardenas',     identification: '1047487356', pct: 31.11, roi: 2096734, bankAccount: '' },
      { name: 'Santiago Carranza', identification: '',           pct: 5.93,  roi: 344069,  bankAccount: '' },
      { name: 'Carlos Carranza',   identification: '',           pct: 5.93,  roi: 344069,  bankAccount: '' },
      { name: 'Jonny Lopez',       identification: '71385705',   pct: 10,    roi: 580631,  bankAccount: '' },
      { name: 'Felipe Velez',      identification: '1152710460', pct: 36.11, roi: 2096734, bankAccount: '' },
      { name: 'Sebastian Barrios', identification: '1047501328', pct: 5.93,  roi: 344069,  bankAccount: '' },
    ],
  },
}

const localKey = process.argv[process.argv.indexOf('--local') + 1]
const LOCAL = LOCALES[localKey]
if (!LOCAL) {
  console.error(`Falta --local. Opciones: ${Object.keys(LOCALES).join(', ')}`)
  process.exit(1)
}

const { companyId: COMPANY_ID, socios: SOCIOS, target: TARGET } = LOCAL

const fmt = (n) => '$' + (Number(n) || 0).toLocaleString('es-CO')
const norm = (s) => (s ?? '').trim().toLowerCase()

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()
const { Timestamp } = admin.firestore

console.log(`Local: ${LOCAL.label} (${COMPANY_ID})`)
console.log(`Modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (no escribe)'}\n`)

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 1 — socios en /partners (colección RAÍZ, compartida entre locales)
// ─────────────────────────────────────────────────────────────────────────────
const partnersCol = db.collection('partners')
const existing = await partnersCol.get()
const byName = new Map(existing.docs.map((d) => [norm(d.data().name), d]))

console.log(`── Socios (catálogo /partners, ${existing.size} existentes) ──`)

const batch = db.batch()
// name → ref, para la etapa 2. Los nuevos necesitan su id antes del commit, por
// eso se usa partnersCol.doc(), que lo genera en el cliente.
const refByName = new Map()
let creados = 0
let actualizados = 0
let sinCambios = 0

for (const s of SOCIOS) {
  const found = byName.get(norm(s.name))

  if (!found) {
    const ref = partnersCol.doc()
    const now = Timestamp.now()
    console.log(`   + ${s.name}: nuevo — ${s.pct}%, cuenta ${s.bankAccount || '(pendiente)'}`)
    refByName.set(s.name, ref)
    creados++
    if (APPLY) {
      batch.set(ref, {
        name: s.name,
        identification: s.identification,
        phone: '',
        bankName: s.bankAccount ? 'Bancolombia' : '',
        bankAccount: s.bankAccount,
        status: 'active',
        participations: { [COMPANY_ID]: s.pct },
        createdAt: now,
        updatedAt: now,
      })
    }
    continue
  }

  // Existente: se completa lo que falte, nunca se pisa lo que ya hay.
  const cur = found.data()
  refByName.set(s.name, found.ref)
  const updates = {}

  if (!cur.identification && s.identification) updates.identification = s.identification
  if (!cur.bankAccount && s.bankAccount) updates.bankAccount = s.bankAccount
  if (!cur.bankName && (s.bankAccount || cur.bankAccount)) updates.bankName = 'Bancolombia'
  if (cur.status !== 'active') updates.status = 'active'

  // Merge de participaciones: no tocar las de otros locales.
  if ((cur.participations?.[COMPANY_ID] ?? null) !== s.pct) {
    updates.participations = { ...(cur.participations ?? {}), [COMPANY_ID]: s.pct }
  }

  // La cuenta del archivo no coincide con la registrada: se avisa y se conserva
  // la registrada (puede ser una cuenta más nueva puesta desde la UI).
  if (s.bankAccount && cur.bankAccount && cur.bankAccount !== s.bankAccount) {
    console.log(`   ! ${cur.name}: cuenta distinta (registrada ${cur.bankAccount} vs archivo ${s.bankAccount}) — se deja la registrada`)
  }

  if (Object.keys(updates).length === 0) {
    console.log(`   · ${cur.name}: sin cambios`)
    sinCambios++
    continue
  }

  const campos = Object.keys(updates).join(', ')
  updates.updatedAt = Timestamp.now()
  console.log(`   ~ ${cur.name}: ${campos} → ${s.pct}%`)
  actualizados++
  if (APPLY) batch.update(found.ref, updates)
}

const totalPct = SOCIOS.reduce((acc, s) => acc + s.pct, 0)
console.log(`   = ${creados} nuevos, ${actualizados} actualizados, ${sinCambios} sin cambios — participación total ${Math.round(totalPct * 100) / 100}%\n`)

if (APPLY && (creados > 0 || actualizados > 0)) {
  await batch.commit()
  console.log('✔ Socios escritos.\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 2 — ROI del mes objetivo en companies/{local}/transactions
// ─────────────────────────────────────────────────────────────────────────────
const txCol = db.collection('companies').doc(COMPANY_ID).collection('transactions')
const roiSnap = await txCol.where('documentKind', '==', 'roi').get()

// Socios que ya tienen ROI en el mes objetivo (misma idempotencia que el cron).
const yaExiste = new Set()
for (const d of roiSnap.docs) {
  const t = d.data()
  const acc = t.accrualDate?.toDate?.()
  if (!acc) continue
  if (acc.getFullYear() === TARGET.year && acc.getMonth() === TARGET.month && t.payeeRef?.id) {
    yaExiste.add(t.payeeRef.id)
  }
}

const monthLabel = `${MESES_ES[TARGET.month]} ${TARGET.year}`
const accrualDate = Timestamp.fromDate(new Date(TARGET.year, TARGET.month, 1, 12, 0, 0))

console.log(`── ROI ${monthLabel} (pendiente) — ${roiSnap.size} ROIs existentes en el local ──`)

const roiBatch = db.batch()
let roiCount = 0
let roiTotal = 0
let roiSaltados = 0

for (const s of SOCIOS) {
  if (s.roi <= 0) {
    console.log(`   · ${s.name}: sin ROI (socio gestor sin capital), salto`)
    continue
  }
  const ref = refByName.get(s.name)
  if (!ref) continue

  if (yaExiste.has(ref.id)) {
    console.log(`   · ${s.name}: ya tiene ROI en ${monthLabel}, salto`)
    roiSaltados++
    continue
  }

  const now = Timestamp.now()
  console.log(`   + ${s.name}: ${fmt(s.roi)}`)
  roiCount++
  roiTotal += s.roi
  if (APPLY) {
    roiBatch.set(txCol.doc(), {
      concept: `ROI ${monthLabel} — ${s.name}`,
      category: ROI_CATEGORY,
      amount: s.roi,
      type: 'expense',
      status: 'pending',
      documentKind: 'roi',
      payeeRef: { type: 'partner', id: ref.id, name: s.name },
      accrualDate,
      date: now,
      createdAt: now,
      updatedAt: now,
      sourceType: `roi-seed-${localKey}`,
    })
  }
}

console.log(`   = ${roiCount} pendientes, ${fmt(roiTotal)}   (saltados por existir: ${roiSaltados})\n`)

if (APPLY && roiCount > 0) {
  await roiBatch.commit()
  console.log('✔ ROI escrito en Firestore.')
} else if (!APPLY) {
  console.log('(dry-run — nada escrito; corré con --apply para aplicar)')
}

process.exit(0)
