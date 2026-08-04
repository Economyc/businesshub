import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// Reglas de `empresas-bf`, compartidas por BusinessHub y Ecore.
// Cada caso mapea a un hallazgo del escaneo de seguridad de jul-2026 o a un
// flujo que NO se puede romper al endurecerlas.

const OWNER_EMAIL = 'admin@filipoblue.co'

// Companias del fixture:
//   A -> tiene miembro activo, miembro suspendido y roles
//   B -> otra compania, para probar el aislamiento cross-tenant
//   C -> sin members ni roles (espeja "Administrativo" en produccion)
const A = 'companyA'
const B = 'companyB'
const C = 'companyC'

let testEnv: RulesTestEnvironment

/** Owner por email: no tiene doc de miembro en ninguna compania del fixture. */
function owner() {
  return testEnv.authenticatedContext('uid-owner', { email: OWNER_EMAIL }).firestore()
}
/** Miembro activo de A. */
function activeA() {
  return testEnv.authenticatedContext('uid-active-a', { email: 'a@test.co' }).firestore()
}
/** Miembro activo de B — sirve para probar acceso cruzado contra A. */
function activeB() {
  return testEnv.authenticatedContext('uid-active-b', { email: 'b@test.co' }).firestore()
}
/** Miembro de A con status 'suspended'. */
function suspendedA() {
  return testEnv.authenticatedContext('uid-susp', { email: 's@test.co' }).firestore()
}
/** Autenticado sin doc de miembro en ninguna compania. */
function stranger() {
  return testEnv.authenticatedContext('uid-none', { email: 'x@test.co' }).firestore()
}
function anon() {
  return testEnv.unauthenticatedContext().firestore()
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-businesshub-rules',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()

    await setDoc(doc(db, 'companies', A), { name: 'Blue Manila', logo: 'https://x/l.png' })
    await setDoc(doc(db, 'companies', B), { name: 'Filipo' })
    await setDoc(doc(db, 'companies', C), { name: 'Administrativo' })

    await setDoc(doc(db, 'companies', A, 'members', 'uid-active-a'), {
      userId: 'uid-active-a', email: 'a@test.co', role: 'viewer', status: 'active',
    })
    await setDoc(doc(db, 'companies', A, 'members', 'uid-susp'), {
      userId: 'uid-susp', email: 's@test.co', role: 'viewer', status: 'suspended',
    })
    await setDoc(doc(db, 'companies', B, 'members', 'uid-active-b'), {
      userId: 'uid-active-b', email: 'b@test.co', role: 'viewer', status: 'active',
    })

    await setDoc(doc(db, 'companies', A, 'roles', 'viewer'), {
      label: 'Solo lectura', canManageUsers: false, permissions: { pages: {}, tabs: {} },
    })
    await setDoc(doc(db, 'companies', B, 'roles', 'viewer'), {
      label: 'Solo lectura', canManageUsers: false, permissions: { pages: {}, tabs: {} },
    })

    await setDoc(doc(db, 'companies', A, 'transactions', 't1'), { amount: 1000 })
    await setDoc(doc(db, 'companies', A, 'employees', 'e1'), { name: 'Ana', salary: 3000000 })
    await setDoc(doc(db, 'companies', B, 'employees', 'e1'), { name: 'Beto', salary: 4000000 })

    await setDoc(doc(db, 'documentTemplates', 'tpl1'), {
      name: 'Contrato', entity: 'general', downloadUrl: 'https://firebasestorage.googleapis.com/x',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Lo que NO se puede romper
// ─────────────────────────────────────────────────────────────────────────────
describe('funcionalidad que debe seguir andando', () => {
  it('cualquier autenticado lista la coleccion raiz companies (selector de empresas)', async () => {
    await assertSucceeds(getDocs(collection(activeA(), 'companies')))
    await assertSucceeds(getDocs(collection(stranger(), 'companies')))
  })

  it('un usuario lee su propio doc de miembro en CUALQUIER compania', async () => {
    // company-provider barre todas las companias para armar el mapa de acceso.
    await assertSucceeds(getDoc(doc(activeA(), 'companies', A, 'members', 'uid-active-a')))
    await assertSucceeds(getDoc(doc(activeA(), 'companies', B, 'members', 'uid-active-a')))
    await assertSucceeds(getDoc(doc(activeA(), 'companies', C, 'members', 'uid-active-a')))
  })

  it('un miembro lee y lista los roles de su compania', async () => {
    await assertSucceeds(getDoc(doc(activeA(), 'companies', A, 'roles', 'viewer')))
    await assertSucceeds(getDocs(collection(activeA(), 'companies', A, 'roles')))
  })

  it('un miembro activo lista el equipo de su compania', async () => {
    await assertSucceeds(getDocs(collection(activeA(), 'companies', A, 'members')))
  })

  it('un miembro activo lee y escribe las subcolecciones de negocio de su compania', async () => {
    await assertSucceeds(getDoc(doc(activeA(), 'companies', A, 'transactions', 't1')))
    await assertSucceeds(getDocs(collection(activeA(), 'companies', A, 'transactions')))
    await assertSucceeds(setDoc(doc(activeA(), 'companies', A, 'transactions', 't2'), { amount: 50 }))
    await assertSucceeds(updateDoc(doc(activeA(), 'companies', A, 'employees', 'e1'), { salary: 1 }))
    await assertSucceeds(
      setDoc(doc(activeA(), 'companies', A, 'settings', 'paymentMethods'), { list: [] }),
    )
  })

  it('un miembro activo actualiza el doc de compania (logoThumb en background)', async () => {
    await assertSucceeds(updateDoc(doc(activeA(), 'companies', A), { logoThumb: 'data:...' }))
  })

  it('el owner por email entra a companias donde no tiene doc de miembro', async () => {
    await assertSucceeds(getDoc(doc(owner(), 'companies', A, 'employees', 'e1')))
    await assertSucceeds(getDoc(doc(owner(), 'companies', B, 'employees', 'e1')))
    await assertSucceeds(setDoc(doc(owner(), 'companies', C, 'transactions', 't9'), { amount: 1 }))
  })

  it('el owner se auto-siembra como miembro (seedMembershipIfNeeded)', async () => {
    await assertSucceeds(
      setDoc(doc(owner(), 'companies', C, 'members', 'uid-owner'), {
        userId: 'uid-owner', email: OWNER_EMAIL, role: 'owner', status: 'active',
      }),
    )
  })

  it('el owner administra roles y plantillas de documentos', async () => {
    await assertSucceeds(
      setDoc(doc(owner(), 'companies', A, 'roles', 'finance'), { label: 'Contador' }),
    )
    await assertSucceeds(updateDoc(doc(owner(), 'documentTemplates', 'tpl1'), { name: 'Otro' }))
  })

  it('los catalogos raiz compartidos siguen abiertos a autenticados', async () => {
    await assertSucceeds(setDoc(doc(activeA(), 'suppliers', 's1'), { name: 'Proveedor' }))
    await assertSucceeds(setDoc(doc(activeA(), 'customers', 'c1'), { name: 'Cliente' }))
    await assertSucceeds(setDoc(doc(activeA(), 'partners', 'p1'), { name: 'Socio' }))
    await assertSucceeds(getDoc(doc(activeA(), 'documentTemplates', 'tpl1')))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Los hallazgos del escaneo
// ─────────────────────────────────────────────────────────────────────────────
describe('F1/F7 — autopromocion a owner', () => {
  it('un miembro no puede reescribir su propio doc de miembro', async () => {
    await assertFails(
      updateDoc(doc(activeA(), 'companies', A, 'members', 'uid-active-a'), { role: 'owner' }),
    )
    await assertFails(
      setDoc(doc(activeA(), 'companies', A, 'members', 'uid-active-a'), {
        userId: 'uid-active-a', role: 'owner', status: 'active',
      }),
    )
  })

  it('un extrano no puede crearse un doc de miembro', async () => {
    await assertFails(
      setDoc(doc(stranger(), 'companies', A, 'members', 'uid-none'), {
        userId: 'uid-none', role: 'owner', status: 'active',
      }),
    )
  })

  it('nadie puede borrar ni suspender a otro miembro desde el cliente', async () => {
    await assertFails(deleteDoc(doc(activeA(), 'companies', A, 'members', 'uid-susp')))
    // Ni siquiera el owner: eso va por callable con Admin SDK.
    await assertFails(
      updateDoc(doc(owner(), 'companies', A, 'members', 'uid-active-a'), { status: 'suspended' }),
    )
  })
})

describe('F14 — escalar privilegios via definiciones de rol', () => {
  it('un miembro no puede darle canManageUsers a su propio rol', async () => {
    await assertFails(
      setDoc(doc(activeA(), 'companies', A, 'roles', 'viewer'), {
        label: 'v', canManageUsers: true, canManageCompany: true,
      }),
    )
    await assertFails(deleteDoc(doc(activeA(), 'companies', A, 'roles', 'viewer')))
  })
})

describe('F4/F5/F6 — aislamiento entre companias', () => {
  it('un miembro de B no lee la PII de empleados de A', async () => {
    await assertFails(getDoc(doc(activeB(), 'companies', A, 'employees', 'e1')))
    await assertFails(getDocs(collection(activeB(), 'companies', A, 'employees')))
  })

  // Empleados compartidos entre sedes (Ecore): una persona que rota entre
  // locales se replica con el MISMO doc id en cada company. Vincular es escribir
  // en la sede destino, así que sólo puede hacerlo quien es miembro de ambas.
  it('un miembro de B no puede replicar un empleado en A (vinculo entre sedes)', async () => {
    await assertFails(
      setDoc(doc(activeB(), 'companies', A, 'employees', 'e-shared'), {
        name: 'Compartido', companyIds: [A, B], primaryCompanyId: B,
      }),
    )
  })

  it('un miembro de B no lee ni escribe las transacciones de A', async () => {
    await assertFails(getDocs(collection(activeB(), 'companies', A, 'transactions')))
    await assertFails(setDoc(doc(activeB(), 'companies', A, 'transactions', 'x'), { amount: 1 }))
    await assertFails(deleteDoc(doc(activeB(), 'companies', A, 'transactions', 't1')))
  })

  it('un autenticado sin membresia no toca ninguna subcoleccion', async () => {
    await assertFails(getDoc(doc(stranger(), 'companies', A, 'transactions', 't1')))
    await assertFails(getDoc(doc(stranger(), 'companies', A, 'employees', 'e1')))
    await assertFails(getDocs(collection(stranger(), 'companies', A, 'members')))
  })

  it('un miembro suspendido queda afuera de los datos de su compania', async () => {
    await assertFails(getDoc(doc(suspendedA(), 'companies', A, 'transactions', 't1')))
    await assertFails(setDoc(doc(suspendedA(), 'companies', A, 'transactions', 'x'), { amount: 1 }))
    await assertFails(updateDoc(doc(suspendedA(), 'companies', A), { name: 'hack' }))
  })

  it('un anonimo no lee nada', async () => {
    await assertFails(getDocs(collection(anon(), 'companies')))
    await assertFails(getDoc(doc(anon(), 'companies', A, 'employees', 'e1')))
    await assertFails(getDoc(doc(anon(), 'documentTemplates', 'tpl1')))
  })
})

describe('F2 (parcial) — borrar la compania entera', () => {
  it('un miembro no puede borrar ni crear companias', async () => {
    await assertFails(deleteDoc(doc(activeA(), 'companies', A)))
    await assertFails(setDoc(doc(activeA(), 'companies', 'nueva'), { name: 'Mia' }))
  })
})

describe('F13/F17 — catalogo de plantillas de documentos', () => {
  it('un miembro cualquiera no puede reescribir ni borrar una plantilla', async () => {
    await assertFails(
      updateDoc(doc(activeA(), 'documentTemplates', 'tpl1'), { downloadUrl: 'https://evil.tld/x' }),
    )
    await assertFails(deleteDoc(doc(activeA(), 'documentTemplates', 'tpl1')))
    // Doc malformado que tumbaba el render de /documentos.
    await assertFails(setDoc(doc(activeA(), 'documentTemplates', 'tpl2'), { entity: 'general' }))
  })
})
