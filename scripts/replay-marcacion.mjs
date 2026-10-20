#!/usr/bin/env node
// Vuelve a decidir entrada/salida de cada marcacion facial real con la logica
// compilada en functions/lib (decidePunch) y la compara con lo que quedo
// despues de las correcciones (el empleado en el kiosco o el admin). Sirve
// para medir un cambio en la logica: correr antes y despues de `npm run build`
// en functions/.
//
// Uso:
//   node scripts/replay-marcacion.mjs [--days 30] [--verbose]
//
// Limitaciones: usa los turnos de Horarios como estan HOY (pueden haber
// cambiado despues de la marcacion), y una correccion hecha moviendo horas en
// vez de cambiar el tipo no se ve como error.
//
// Autenticacion: gcloud auth application-default login (ADC). Read-only.

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))
const { decidePunch, isDuplicate } = await import(pathToFileURL(join(__dirname, '../functions/lib/attendance/match.js')).href)

const args = process.argv.slice(2)
const days = Number(args[args.indexOf('--days') + 1]) || 30
const verbose = args.includes('--verbose')

admin.initializeApp({ projectId: 'empresas-bf' })
const db = admin.firestore()

const DAY = 24 * 60 * 60 * 1000
const fmt = (ms) => new Date(ms - 5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')
const bogotaDate = (ms) => new Date(ms - 5 * 3600e3).toISOString().slice(0, 10)
const since = bogotaDate(Date.now() - days * DAY)

const kiosks = await db.collection('attendanceKiosks').get()
const companyIds = [...new Set(kiosks.docs.map((d) => d.data().companyId))]

let total = 0
let wrong = 0
for (const cid of companyIds) {
  const co = db.collection('companies').doc(cid)
  const name = (await co.get()).data()?.name ?? cid
  const punches = (await co.collection('attendancePunches').where('date', '>=', since).get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.voided)
  const shifts = (await co.collection('shifts').where('date', '>=', bogotaDate(Date.now() - (days + 3) * DAY)).get()).docs
    .map((d) => d.data())
    .filter((s) => s.start && s.end)

  const byEmployee = new Map()
  for (const p of punches) byEmployee.set(p.employeeId, [...(byEmployee.get(p.employeeId) ?? []), p])

  let companyTotal = 0
  let companyWrong = 0
  for (const [employeeId, list] of byEmployee) {
    // Hora en que existio cada marcacion para el kiosco, y su hora original.
    const rows = list.map((p) => ({
      ...p,
      createdMs: (p.createdAt ?? p.at).toMillis(),
      atMs: (p.originalAt ?? p.at).toMillis(),
    }))
    for (const p of rows.filter((r) => r.source === 'face').sort((a, b) => a.createdMs - b.createdMs)) {
      const nowMs = p.createdMs
      const prev = rows
        .filter((r) => r.id !== p.id && r.createdMs < nowMs && r.atMs <= nowMs && nowMs - r.atMs < 2 * DAY)
        .sort((a, b) => b.atMs - a.atMs)[0]
      const last = prev ? { type: prev.type, atMs: prev.atMs, missedIn: prev.missedIn === true } : null
      if (isDuplicate(last, nowMs)) continue
      const dates = [0, 1, 2].map((k) => bogotaDate(nowMs - k * DAY))
      const own = shifts.filter((s) => s.employeeId === employeeId && dates.includes(s.date))
      const decided = decidePunch(last, nowMs, own)
      if (decided.reclassifyLast) console.log(`  ↺ ${fmt(nowMs)} ${p.employeeName?.split(' ')[0]} reclasifica la salida sin entrada de ${fmt(last.atMs)} como entrada`)
      const truth = p.type
      companyTotal += 1
      if (decided.type !== truth) {
        companyWrong += 1
        if (verbose) {
          console.log(`  ✗ ${fmt(nowMs)} ${p.employeeName?.split(' ')[0]} decide=${decided.type}${decided.missedIn ? '(missedIn)' : ''} real=${truth}` +
            ` ultima=${last ? `${last.type}@${fmt(last.atMs)}` : '-'} turnos=${own.map((s) => `${s.date.slice(5)} ${s.start}-${s.end}`).join(',')}`)
        }
      }
    }
  }
  total += companyTotal
  wrong += companyWrong
  console.log(`${name} (${cid}): ${companyWrong} de ${companyTotal} distintas a lo corregido`)
}
console.log(`\nTOTAL: ${wrong} de ${total} (${total ? ((wrong / total) * 100).toFixed(1) : 0}%)`)
process.exit(0)
