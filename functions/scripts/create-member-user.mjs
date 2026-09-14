// Da de alta a una persona en una company: crea el usuario de Auth (si no
// existe) y su membresía activa con el rol indicado.
//
// Hace lo mismo que la callable `adminCreateUser` (Ajustes → Equipo → Invitar),
// pero sirve cuando el email ya existe en Auth —la callable devuelve
// `already-exists` y no agrega la membresía— o cuando nadie con permisos de
// gestión está en la app.
//
// Uso (desde la raíz del repo; ADC vía `gcloud auth application-default login`):
//   node functions/scripts/create-member-user.mjs --company <id> --email <email> --name "<nombre>" --role viewer
//   node functions/scripts/create-member-user.mjs ... --apply
//
// Sin --apply es dry run. Safe de re-correr: si el usuario ya existe no toca su
// contraseña; solo asegura la membresía. La contraseña temporal se imprime una
// sola vez, al crearlo.
//
// Si Auth responde que falta un quota project (credenciales de usuario), correr con
// GOOGLE_CLOUD_QUOTA_PROJECT=empresas-bf.

import { randomBytes } from 'node:crypto'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'empresas-bf'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return undefined
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : undefined
}

const companyId = arg('company')
const email = arg('email')?.trim().toLowerCase()
const displayName = arg('name')?.trim()
const role = arg('role')
const apply = process.argv.includes('--apply')

if (!companyId || !email || !displayName || !role) {
  console.error('Faltan argumentos: --company <id> --email <email> --name "<nombre>" --role <rolId> [--apply]')
  process.exit(1)
}

// Sin caracteres ambiguos (0/O, 1/l/I) para que se pueda dictar.
function temporaryPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
const db = getFirestore()
const auth = getAuth()

const companyRef = db.collection('companies').doc(companyId)
const companySnap = await companyRef.get()
if (!companySnap.exists) {
  console.error(`✖ La company ${companyId} no existe en ${PROJECT_ID}`)
  process.exit(1)
}
const company = companySnap.data()

const roleSnap = await companyRef.collection('roles').doc(role).get()
if (!roleSnap.exists) {
  const roles = await companyRef.collection('roles').get()
  console.error(`✖ El rol "${role}" no existe en la company. Roles: ${roles.docs.map((d) => d.id).join(', ')}`)
  process.exit(1)
}

let user = null
try {
  user = await auth.getUserByEmail(email)
} catch (err) {
  if (err?.code !== 'auth/user-not-found') throw err
}

const memberSnap = user ? await companyRef.collection('members').doc(user.uid).get() : null
const member = memberSnap?.exists ? memberSnap.data() : null

console.log(`Proyecto:  ${PROJECT_ID}`)
console.log(`Empresa:   ${companyId} — "${company.name}" / "${company.location}"`)
console.log(`Persona:   ${displayName} <${email}>`)
console.log(`Rol:       ${role} ("${roleSnap.data().label ?? role}")`)
console.log(`Auth:      ${user ? `ya existe (uid ${user.uid})` : 'no existe → se crea con contraseña temporal'}`)
console.log(`Membresía: ${member ? `ya existe (rol ${member.role}, ${member.status})` : 'no existe → se crea activa'}`)
console.log(`Dry run:   ${apply ? 'no (escribe)' : 'sí'}`)

if (member && member.role === role && member.status === 'active') {
  console.log('\n✓ Ya está dado de alta con ese rol. Nada que hacer.')
  process.exit(0)
}

if (!apply) {
  console.log('\nDry run: no se escribió nada. Repetir con --apply.')
  process.exit(0)
}

let password = null
let created = false
if (!user) {
  password = temporaryPassword()
  user = await auth.createUser({ email, password, displayName })
  created = true
}

try {
  const ref = companyRef.collection('members').doc(user.uid)
  if (member) {
    await ref.update({ role, status: 'active' })
  } else {
    await ref.set({
      userId: user.uid,
      email,
      displayName,
      role,
      status: 'active',
      invitedBy: 'script:create-member-user',
      invitedAt: FieldValue.serverTimestamp(),
      joinedAt: FieldValue.serverTimestamp(),
    })
  }
} catch (err) {
  // Mismo rollback que adminCreateUser: no dejar un usuario de Auth huérfano.
  if (created) await auth.deleteUser(user.uid).catch(() => undefined)
  throw err
}

console.log(`\n✓ Listo: ${email} es miembro activo de "${company.name} / ${company.location}" con rol ${role}.`)
if (password) {
  console.log('\n  Contraseña temporal (se muestra una sola vez):')
  console.log(`  ${password}`)
}
