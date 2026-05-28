// One-shot: crea los empleados de Filipo Belen necesarios para subir la nomina
// de Q1 mayo 2026. Calcado de seed-blue-escondite-employees.mjs: corre con
// Application Default Credentials (gcloud auth application-default login).
//
// Uso (desde functions/):
//   node scripts/seed-filipo-belen-employees.mjs          # DRY RUN (no escribe)
//   node scripts/seed-filipo-belen-employees.mjs --write  # aplica cambios
//
// Idempotente: omite (SKIP) cualquier empleado cuya cedula (solo digitos) o
// cuyo nombre normalizado ya exista en la empresa.

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp({
  credential: applicationDefault(),
  projectId: 'empresas-bf',
})

const db = getFirestore()

// Empleados a crear. department/phone/startDate quedan con placeholder; el
// usuario los ajusta en la UI.
const EMPLOYEES = [
  { name: 'Kelyn Andreina Suarez Rivas', identification: '5466443' },
  { name: 'Juan Pablo Restrepo Ruiz', identification: '1044508163' },
  { name: 'Novar Eduardo Martinez Vasquez', identification: '1018225044' },
  { name: 'Diogenes Antonio Montes Villanueva', identification: '1140420832' },
]

function norm(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function onlyDigits(s) {
  return (s ?? '').replace(/\D/g, '')
}

const DRY = !process.argv.includes('--write')

// --- 1. Resolver la empresa Filipo Belen ---------------------------------
const companiesSnap = await db.collection('companies').get()
const matches = companiesSnap.docs.filter((d) => {
  const data = d.data()
  return norm(data.name).includes('filipo') && norm(data.location) === 'belen'
})

if (matches.length === 0) {
  console.error('[seed] ERROR: no encontre ninguna empresa Filipo Belen.')
  process.exit(1)
}
if (matches.length > 1) {
  console.error(
    `[seed] ERROR: ${matches.length} empresas coinciden con Filipo + Belen; abortando para no adivinar.`,
  )
  for (const m of matches) console.error(`  - id=${m.id} name="${m.data().name}" location="${m.data().location}"`)
  process.exit(1)
}

const company = matches[0]
const companyId = company.id
console.log(
  `[seed] empresa: id=${companyId} name="${company.data().name}" location="${company.data().location}" dry=${DRY}`,
)

// --- 2. Empleados existentes (para idempotencia) -------------------------
const employeesRef = db.collection('companies').doc(companyId).collection('employees')
const existingSnap = await employeesRef.get()
const existing = existingSnap.docs.map((d) => d.data())
const existingDigits = new Set(existing.map((e) => onlyDigits(e.identification)).filter(Boolean))
const existingNames = new Set(existing.map((e) => norm(e.name)))
console.log(`[seed] empleados ya existentes en la empresa: ${existing.length}`)

// --- 3. Crear (o simular) cada empleado ----------------------------------
let created = 0
let skipped = 0

for (const emp of EMPLOYEES) {
  const digits = onlyDigits(emp.identification)
  const alreadyById = digits && existingDigits.has(digits)
  const alreadyByName = existingNames.has(norm(emp.name))
  if (alreadyById || alreadyByName) {
    console.log(
      `[seed] SKIP  "${emp.name}" (${emp.identification || 'sin cedula'}) — ya existe ${alreadyById ? 'por cedula' : 'por nombre'}`,
    )
    skipped++
    continue
  }

  const now = Timestamp.now()
  const doc = {
    name: emp.name,
    identification: emp.identification,
    department: '',
    email: '',
    phone: '',
    startDate: now, // placeholder; el usuario lo ajusta en la UI
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  if (DRY) {
    console.log(`[seed] DRY   CREATE "${emp.name}" (${emp.identification || 'sin cedula'})`)
  } else {
    const ref = await employeesRef.add(doc)
    console.log(`[seed] WRITE CREATE "${emp.name}" (${emp.identification || 'sin cedula'}) → id=${ref.id}`)
  }
  created++
}

console.log(`[seed] done — created=${created} skipped=${skipped} dry=${DRY}`)
process.exit(0)
