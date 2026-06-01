// Diagnostica y corrige el selector de companias para admin@filipopizzeria.com.
// El usuario deberia ver Filipo Belen + Filipo San Lucas. Si solo ve Belen, la
// causa tipica es que su rol tiene allowedCompanyIds sin el ID de San Lucas.
//
// Uso (desde functions/):
//   node scripts/diagnose-filipo-admin.mjs          # solo diagnostico
//   node scripts/diagnose-filipo-admin.mjs --fix    # aplica correccion
//
// Prereq: gcloud auth application-default login

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp({
  credential: applicationDefault(),
  projectId: 'empresas-bf',
})

const db = getFirestore()
const auth = getAuth()
const FIX = process.argv.includes('--fix')
const TARGET_EMAIL = 'admin@filipopizzeria.com'

async function main() {
  console.log(`\n=== DIAGNOSTICO: ${TARGET_EMAIL} ===\n`)

  // 1. Resolver UID
  let userRecord
  try {
    userRecord = await auth.getUserByEmail(TARGET_EMAIL)
  } catch {
    console.error(`ERROR: no se encontro el usuario ${TARGET_EMAIL} en Firebase Auth`)
    process.exit(1)
  }
  const uid = userRecord.uid
  console.log(`UID:          ${uid}`)
  console.log(`Display name: ${userRecord.displayName ?? '(sin nombre)'}`)
  console.log(`Disabled:     ${userRecord.disabled}\n`)

  // 2. Todas las companies
  const companiesSnap = await db.collection('companies').get()
  const companies = companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  console.log(`Companies en Firestore: ${companies.length}`)

  // Identificar Belen y San Lucas (name='Filipo', location='Belen'/'San Lucas')
  const belen = companies.find((c) => c.name?.toLowerCase().includes('filipo') && c.location?.toLowerCase().includes('belen'))
  const sanLucas = companies.find((c) => c.name?.toLowerCase().includes('filipo') && (c.location?.toLowerCase().includes('san lucas') || c.location?.toLowerCase().includes('sanlucas')))

  console.log(`Filipo Belen:     ${belen ? `${belen.name} (${belen.id})` : 'NO ENCONTRADO'}`)
  console.log(`Filipo San Lucas: ${sanLucas ? `${sanLucas.name} (${sanLucas.id})` : 'NO ENCONTRADO'}\n`)

  if (!sanLucas) {
    console.error('ERROR: No se encontro Filipo San Lucas. Verifica el nombre exacto en Firestore.')
    console.log('Companies disponibles:', companies.map((c) => `${c.name} (${c.id})`).join('\n  '))
    process.exit(1)
  }

  // 3. Membresías y roles del usuario
  console.log('=== MEMBRESÍAS DEL USUARIO ===\n')
  const memberships = []

  for (const company of companies) {
    const memberSnap = await db.doc(`companies/${company.id}/members/${uid}`).get()
    if (!memberSnap.exists) continue

    const memberData = memberSnap.data()
    const roleId = memberData.role
    let roleData = null

    if (roleId) {
      const roleSnap = await db.doc(`companies/${company.id}/roles/${roleId}`).get()
      if (roleSnap.exists) {
        roleData = roleSnap.data()
      }
    }

    const entry = {
      company,
      memberData,
      roleId,
      roleData,
    }
    memberships.push(entry)

    const allowed = roleData?.allowedCompanyIds
    const allowedStr = allowed === undefined ? '(sin restriccion)' : JSON.stringify(allowed)
    console.log(`  [${company.name}]`)
    console.log(`    status:            ${memberData.status}`)
    console.log(`    roleId:            ${roleId ?? '(sin rol)'}`)
    console.log(`    allowedCompanyIds: ${allowedStr}`)

    if (Array.isArray(allowed)) {
      const names = allowed.map((id) => companies.find((c) => c.id === id)?.name ?? id)
      console.log(`    empresas permitidas: ${names.join(', ')}`)
    }
    console.log()
  }

  // 4. Diagnostico
  console.log('=== ANALISIS ===\n')

  const isMemberBelen = memberships.some((m) => m.company.id === belen?.id)
  const isMemberSanLucas = memberships.some((m) => m.company.id === sanLucas.id)
  console.log(`  Miembro en Filipo Belen:     ${isMemberBelen ? 'SI' : 'NO'}`)
  console.log(`  Miembro en Filipo San Lucas: ${isMemberSanLucas ? 'SI' : 'NO'}`)

  const restrictedEntries = memberships.filter((m) => Array.isArray(m.roleData?.allowedCompanyIds))
  const allowedUnion = new Set(restrictedEntries.flatMap((m) => m.roleData.allowedCompanyIds))

  if (restrictedEntries.length > 0) {
    console.log(`\n  Roles con restriccion de empresas encontrados:`)
    for (const e of restrictedEntries) {
      console.log(`    - roleId "${e.roleId}" en ${e.company.name}: [${e.roleData.allowedCompanyIds.join(', ')}]`)
    }
    console.log(`\n  Union visible actual: [${[...allowedUnion].join(', ')}]`)
    const sanLucasVisible = allowedUnion.has(sanLucas.id)
    console.log(`  Filipo San Lucas en union: ${sanLucasVisible ? 'SI (ya deberia aparecer)' : 'NO (este es el bug)'}`)
  } else {
    console.log('\n  Ningun rol restrictivo encontrado.')
    if (!isMemberSanLucas) {
      console.log('  El problema es que no hay membresia en Filipo San Lucas.')
    }
  }

  if (!FIX) {
    console.log('\n--- Modo diagnostico. Correr con --fix para aplicar cambios. ---\n')
    return
  }

  // 5. FIX
  console.log('\n=== APLICANDO FIX ===\n')

  // 5a. Actualizar allowedCompanyIds en roles restrictivos que no incluyen San Lucas
  for (const entry of restrictedEntries) {
    const allowed = entry.roleData.allowedCompanyIds
    if (allowed.includes(sanLucas.id)) {
      console.log(`  ROL "${entry.roleId}" en ${entry.company.name}: ya incluye San Lucas. Sin cambio.`)
      continue
    }

    const newAllowed = [...allowed, sanLucas.id]
    const updatedRole = { ...entry.roleData, allowedCompanyIds: newAllowed }

    // Actualizar en la company donde vive el rol
    await db.doc(`companies/${entry.company.id}/roles/${entry.roleId}`).set(updatedRole)
    console.log(`  ROL "${entry.roleId}" en ${entry.company.name}: allowedCompanyIds actualizado -> [${newAllowed.join(', ')}]`)

    // Replicar el rol a San Lucas (mismo patron que replicateRoleToAllowedCompanies)
    await db.doc(`companies/${sanLucas.id}/roles/${entry.roleId}`).set(updatedRole)
    console.log(`  ROL "${entry.roleId}" replicado a ${sanLucas.name}`)
  }

  // 5b. Crear membresia en San Lucas si no existe
  if (!isMemberSanLucas) {
    // Tomar el rol de la membresia de Belen como referencia
    const belenMembership = memberships.find((m) => m.company.id === belen?.id)
    const refRoleId = belenMembership?.memberData?.role ?? null

    const now = Timestamp.now()
    const memberData = {
      userId: uid,
      email: TARGET_EMAIL,
      displayName: userRecord.displayName ?? TARGET_EMAIL,
      role: refRoleId,
      status: 'active',
      joinedAt: now,
      invitedAt: now,
    }
    await db.doc(`companies/${sanLucas.id}/members/${uid}`).set(memberData)
    console.log(`  MEMBRESIA creada en ${sanLucas.name} con rol "${refRoleId}"`)
  } else {
    console.log(`  MEMBRESIA en ${sanLucas.name}: ya existe. Sin cambio.`)
  }

  console.log('\n=== FIX APLICADO ===')
  console.log('El usuario ahora deberia ver ambas empresas al iniciar sesion.')
  console.log(`Si tiene cache activo, puede limpiar localStorage en el browser (clave: companyAccess:v2:${uid}).\n`)
}

main().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})
