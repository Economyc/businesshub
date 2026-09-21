#!/usr/bin/env node
// Carga una quincena de nomina / bonos / propinas en Ecore desde un job file.
//
// Por que a mano y no por la UI: los reportes llegan en Excel y en imagenes, y
// la cuenta de Claude no es miembro de todas las companies (las reglas de
// Firestore tumban la escritura desde el cliente). El Admin SDK pasa por encima.
//
// El shape que escribe es EXACTAMENTE el de savePayrollHalf en
// Ecore/src/modules/invoicing/payroll-batch-service.ts:55-126, que es lo que
// escribe la UI. Si ese archivo cambia, este script hay que revisarlo.
//
// OJO: el doc id de transactions es aleatorio y Firestore no tiene ninguna
// proteccion contra duplicar. Cargar dos veces la misma quincena NO falla: el
// empleado pasa a "N registros" en solo-lectura en la card. De ahi el chequeo
// anti-duplicado, que replica filterHalfRecords (payroll-period.ts:143-153):
// lo que ya esta cargado se omite (SKIP) y solo entra lo nuevo, asi que el job
// file de una quincena se puede volver a correr cuando llega una fuente que
// faltaba. Si el monto ya cargado no coincide con el del job file, se avisa.
//
// Uso:
//   node scripts/cargar-nomina-quincena.mjs scripts/jobs/nomina-2026-09-Q1.json           # DRY-RUN
//   node scripts/cargar-nomina-quincena.mjs scripts/jobs/nomina-2026-09-Q1.json --apply
//
// Autenticacion: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { leerNetoAPagar } from './lib/siigo-neto-a-pagar.mjs'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))

const PROJECT_ID = 'empresas-bf'
const APPLY = process.argv.includes('--apply')
const JOB_FILE = process.argv.slice(2).find((a) => !a.startsWith('--'))

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Espejo de HALF_CARD_CONFIG (payroll-period.ts:67-105). Las propinas NO llevan
// payrollKind: no son un subtipo de nomina.
const KINDS = {
  salary: { documentKind: 'payroll', payrollKind: 'salary', category: 'Nómina', conceptPrefix: 'Nómina' },
  bonus: { documentKind: 'payroll', payrollKind: 'bonus', category: 'Bonos', conceptPrefix: 'Bono' },
  tip: { documentKind: 'tip', payrollKind: null, category: 'Propinas', conceptPrefix: 'Propinas' },
}

const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-CO')
const fail = (msg) => { console.error('\nABORTA: ' + msg); process.exit(1) }

// "DANILO  MEDINA  " -> "Danilo Medina". Solo para quien no tiene historico:
// el nombre de la ficha viene en MAYUSCULAS y con espacios de mas.
const normalizarNombre = (s) =>
  String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
    .replace(/(^|\s|-)([a-záéíóúñü])/g, (_, p, c) => p + c.toUpperCase())

if (!JOB_FILE) fail('falta el job file. Uso: node scripts/cargar-nomina-quincena.mjs <job.json> [--apply]')

const job = JSON.parse(readFileSync(resolve(JOB_FILE), 'utf8'))
const { year, month, half, paidDate: paidISO, jobs } = job
if (![1, 2].includes(half)) fail('half debe ser 1 o 2')
if (!/^\d{4}-\d{2}-\d{2}$/.test(paidISO)) fail('paidDate debe ser YYYY-MM-DD')

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()
const { Timestamp } = admin.firestore

// Mediodia en ambas fechas, igual que payroll-batch-service.ts:62-65: evita que
// el desfase de zona horaria corra el registro al dia/mes anterior.
const ACCRUAL = new Date(year, month, 1, 12, 0, 0)
const PAID = new Date(paidISO + 'T12:00:00')
const MES_INICIO = new Date(year, month, 1, 0, 0, 0)
const MES_FIN = new Date(year, month + 1, 1, 0, 0, 0)
const PERIOD_LABEL = `${MESES_ES[month]} ${year}`

console.log(`\nQ${half} ${PERIOD_LABEL}  ·  devengo ${ACCRUAL.toLocaleDateString('es-CO')}  ·  pago ${PAID.toLocaleDateString('es-CO')}`)
console.log(APPLY ? '>>> MODO APPLY: va a escribir en Firestore\n' : '>>> DRY-RUN (agrega --apply para escribir)\n')

const plan = []

for (const j of jobs) {
  const cfg = KINDS[j.kind]
  if (!cfg) fail(`${j.label}: kind "${j.kind}" desconocido (salary | bonus | tip)`)
  const ref = db.collection('companies').doc(j.companyId)

  const company = await ref.get()
  if (!company.exists) fail(`${j.label}: company ${j.companyId} no existe`)

  // 1. El metodo de pago tiene que existir en el catalogo de ESA company: el
  //    valor que guarda la UI es el NOMBRE, no el id (use-payment-method-options.ts).
  const pm = await ref.collection('settings').doc('paymentMethods').get()
  const metodos = (pm.data()?.list || []).map((m) => (typeof m === 'string' ? m : m.name))
  if (!metodos.includes(j.paymentMethod)) {
    fail(`${j.label}: método "${j.paymentMethod}" no existe. Disponibles: ${metodos.join(' | ') || '(ninguno)'}`)
  }

  const emps = (await ref.collection('employees').get()).docs

  // Historico para (a) el nombre y (b) el anti-duplicado. Un solo where de
  // igualdad, sin orderBy, para no necesitar indice compuesto.
  const previos = (await ref.collection('transactions').where('documentKind', '==', cfg.documentKind).get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => (cfg.payrollKind ? (t.payrollKind ?? 'salary') === cfg.payrollKind : true))

  // 2. Nomina legacy de App1: no tiene documentKind y es INVISIBLE para el
  //    modulo, asi que un duplicado ahi no lo detectaria nadie. Pesa igual en
  //    el P&L. App1 dejo de escribir en mayo 2026, pero el script se reusa.
  if (j.kind === 'salary') {
    const legacy = (await ref.collection('transactions').where('category', '==', 'Nómina > Salarios').get()).docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) => {
        const d = (t.accrualDate ?? t.paidDate ?? t.date)?.toDate?.()
        return d && d >= MES_INICIO && d < MES_FIN
      })
    if (legacy.length) {
      fail(`${j.label}: hay ${legacy.length} registro(s) de nómina LEGACY de App1 en ${PERIOD_LABEL} ` +
        `(category "Nómina > Salarios", sin documentKind, invisibles en la UI). ` +
        `Revisar antes de cargar: ${legacy.map((t) => t.id).join(', ')}`)
    }
  }

  // 3. Las filas: del reporte de Siigo, o listadas a mano en el job file.
  let filas = []
  if (j.siigo) {
    const leidas = leerNetoAPagar(j.siigo.file)
    filas = j.siigo.sede
      ? leidas.filter((r) => r.sede === j.siigo.sede.toUpperCase())
      : leidas
    if (!filas.length) fail(`${j.label}: el reporte no trajo filas${j.siigo.sede ? ` para la sede ${j.siigo.sede}` : ''}`)
    filas = filas.map((r) => ({ cedula: r.cedula, amount: r.amount, siigoName: r.siigoName }))
  } else if (Array.isArray(j.rows)) {
    filas = j.rows
  } else {
    fail(`${j.label}: el job no trae ni "siigo" ni "rows"`)
  }

  const items = []
  for (const f of filas) {
    if (!(Number.isInteger(f.amount) && f.amount > 0)) {
      fail(`${j.label}: monto inválido para ${f.cedula ?? f.employeeId}: ${JSON.stringify(f.amount)}`)
    }

    // La fila se identifica por cedula (resuelta contra employees) o por
    // employeeId explicito, para quien no tiene ficha en esa sede.
    let empId, ficha
    if (f.employeeId) {
      empId = f.employeeId
      ficha = emps.find((e) => e.id === empId)
    } else if (f.cedula) {
      const match = emps.filter((e) => String(e.data().identification || '').trim() === String(f.cedula).trim())
      if (match.length === 0) fail(`${j.label}: cédula ${f.cedula} (${f.siigoName ?? f.name ?? '?'}) no está en employees`)
      if (match.length > 1) fail(`${j.label}: cédula ${f.cedula} aparece en ${match.length} fichas: ${match.map((m) => m.id).join(', ')}`)
      ficha = match[0]
      empId = ficha.id
    } else {
      fail(`${j.label}: fila sin cedula ni employeeId: ${JSON.stringify(f)}`)
    }

    // 4. Anti-duplicado: mismo empleado + misma quincena + mismo mes devengado.
    //    Criterio calcado de filterHalfRecords (payroll-period.ts:143-153).
    const mios = previos.filter((t) => t.payeeRef?.id === empId)
    const dup = mios.find((t) => {
      if (t.payrollHalf !== half) return false
      const d = (t.accrualDate ?? t.paidDate ?? t.date)?.toDate?.()
      return d && d >= MES_INICIO && d < MES_FIN
    })
    // Duplicado = SKIP, no error: asi el job file de la quincena se puede
    // volver a correr cuando llega una fuente que faltaba, y solo entra lo
    // nuevo. Lo omitido sale igual en el informe para que no pase de agache.

    // El nombre sale del historico para no cambiar como aparece escrito entre
    // quincenas; si no tiene, de la ficha normalizada. Nunca el nombre de
    // Siigo, que es el legal y difiere del de Ecore en la mayoria de casos.
    const ultimo = mios.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))[0]
    const d = ficha?.data()
    const name = ultimo?.payeeRef?.name
      || f.name
      || normalizarNombre([d?.firstName, d?.lastName].filter(Boolean).join(' ') || d?.name)
    if (!name) fail(`${j.label}: no pude resolver nombre para ${empId}`)

    items.push({
      empId,
      name,
      amount: f.amount,
      cedula: f.cedula ?? d?.identification ?? '',
      status: ficha ? d.status : '(sin ficha aquí)',
      siigoName: f.siigoName,
      skip: dup ? { id: dup.id, amount: dup.amount } : null,
    })
  }

  plan.push({ ...j, cfg, ref, items })
}

// --- Informe ---
let granTotal = 0
let granCount = 0
let granSkip = 0
for (const p of plan) {
  const nuevos = p.items.filter((r) => !r.skip)
  const omitidos = p.items.filter((r) => r.skip)
  const total = nuevos.reduce((s, r) => s + r.amount, 0)
  granTotal += total
  granCount += nuevos.length
  granSkip += omitidos.length
  console.log(`## ${p.label} — ${p.kind} — ${p.paymentMethod} — ${nuevos.length} nuevos` +
    (omitidos.length ? `, ${omitidos.length} ya cargados` : ''))
  for (const r of p.items) {
    const alias = r.siigoName && normalizarNombre(r.siigoName) !== r.name ? `  (Siigo: ${r.siigoName})` : ''
    // Mismo empleado y quincena pero otro monto: puede ser una correccion que
    // toca aplicar a mano (el script no pisa lo que ya esta escrito).
    const nota = r.skip && r.skip.amount !== r.amount ? `  <-- OJO: cargado ${fmt(r.skip.amount)}` : ''
    console.log(`   ${r.skip ? 'SKIP ' : 'NUEVO'} ${r.name.padEnd(34)} ${String(r.cedula).padStart(11)}  ${fmt(r.amount).padStart(12)}  ${String(r.status).padEnd(16)}${alias}${nota}`)
  }
  console.log(`   ${'      A ESCRIBIR'.padEnd(40)} ${fmt(total).padStart(12)}\n`)
}
console.log(`TOTAL GENERAL: ${granCount} registros a escribir, ${fmt(granTotal)}` +
  (granSkip ? `  (${granSkip} omitidos por estar ya cargados)` : '') + '\n')
if (granCount === 0) { console.log('No hay nada nuevo que cargar.'); process.exit(0) }

if (!APPLY) { console.log('(dry-run: no se escribió nada)'); process.exit(0) }

for (const p of plan) {
  const nuevos = p.items.filter((r) => !r.skip)
  if (!nuevos.length) continue
  const batch = db.batch()
  const now = Timestamp.now()
  for (const r of nuevos) {
    batch.set(p.ref.collection('transactions').doc(), {
      concept: `${p.cfg.conceptPrefix} Q${half} ${PERIOD_LABEL} — ${r.name}`,
      category: p.cfg.category,
      amount: r.amount,
      type: 'expense',
      date: now,
      status: 'paid',
      documentKind: p.cfg.documentKind,
      ...(p.cfg.payrollKind ? { payrollKind: p.cfg.payrollKind } : {}),
      payrollHalf: half,
      payeeRef: { type: 'employee', id: r.empId, name: r.name },
      accrualDate: Timestamp.fromDate(ACCRUAL),
      paidDate: Timestamp.fromDate(PAID),
      paymentMethod: p.paymentMethod,
      createdAt: now,
      updatedAt: now,
    })
  }
  await batch.commit()
  console.log(`ESCRITO  ${p.label} — ${nuevos.length} registros`)
}
process.exit(0)
