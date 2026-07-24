import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// Hasta jul-2026 storage.rules era `allow read, write: if true`: el bucket
// entero abierto a internet sin login (hallazgo F3). Estos tests fijan el
// contrato nuevo — y de paso verifican que las subidas legitimas siguen
// funcionando.

const OWNER_EMAIL = 'admin@filipoblue.co'

const LOGO = 'logos/companyA/logo.png'
const TEMPLATE = 'document-templates/uuid-1/Contrato.docx'
const EMPLOYEE_DOC = 'employees/companyA/emp1/cedula.pdf'

const PNG = { contentType: 'image/png' }
const DOCX = {
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

let testEnv: RulesTestEnvironment

function bytes() {
  return new Uint8Array([1, 2, 3, 4])
}

function owner() {
  return testEnv.authenticatedContext('uid-owner', { email: OWNER_EMAIL }).storage()
}
function member() {
  return testEnv.authenticatedContext('uid-member', { email: 'a@test.co' }).storage()
}
function anon() {
  return testEnv.unauthenticatedContext().storage()
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-businesshub-rules',
    storage: {
      rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearStorage()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const storage = ctx.storage()
    await uploadBytes(ref(storage, LOGO), bytes(), PNG)
    await uploadBytes(ref(storage, TEMPLATE), bytes(), DOCX)
    await uploadBytes(ref(storage, EMPLOYEE_DOC), bytes(), { contentType: 'application/pdf' })
  })
})

describe('F3 — el bucket ya no esta abierto a internet', () => {
  it('un anonimo no lee ningun objeto', async () => {
    await assertFails(getBytes(ref(anon(), LOGO)))
    await assertFails(getBytes(ref(anon(), TEMPLATE)))
    await assertFails(getBytes(ref(anon(), EMPLOYEE_DOC)))
  })

  it('un anonimo no sobrescribe ni borra objetos', async () => {
    await assertFails(uploadBytes(ref(anon(), TEMPLATE), bytes(), DOCX))
    await assertFails(uploadBytes(ref(anon(), LOGO), bytes(), PNG))
    await assertFails(deleteObject(ref(anon(), TEMPLATE)))
  })

  it('los prefijos desconocidos estan denegados incluso para el owner', async () => {
    await assertFails(uploadBytes(ref(owner(), 'random/payload.exe'), bytes()))
    await assertFails(getBytes(ref(member(), 'random/payload.exe')))
  })
})

describe('logos de empresa', () => {
  it('un autenticado lee y sube logos', async () => {
    await assertSucceeds(getBytes(ref(member(), LOGO)))
    await assertSucceeds(uploadBytes(ref(member(), 'logos/companyB/l.png'), bytes(), PNG))
  })

  it('no se puede subir algo que no sea imagen al prefijo de logos', async () => {
    await assertFails(
      uploadBytes(ref(member(), 'logos/companyA/payload.html'), bytes(), {
        contentType: 'text/html',
      }),
    )
  })
})

describe('F13 — plantillas de documentos', () => {
  it('cualquier autenticado las descarga', async () => {
    await assertSucceeds(getBytes(ref(member(), TEMPLATE)))
  })

  it('un miembro no-owner no puede reemplazar ni borrar una plantilla', async () => {
    await assertFails(uploadBytes(ref(member(), TEMPLATE), bytes(), DOCX))
    await assertFails(deleteObject(ref(member(), TEMPLATE)))
  })

  it('el owner sube, reemplaza y borra plantillas', async () => {
    await assertSucceeds(
      uploadBytes(ref(owner(), 'document-templates/uuid-2/Nuevo.docx'), bytes(), DOCX),
    )
    await assertSucceeds(uploadBytes(ref(owner(), TEMPLATE), bytes(), DOCX))
    await assertSucceeds(deleteObject(ref(owner(), TEMPLATE)))
  })
})

describe('documentos de empleados', () => {
  it('un autenticado lee y sube documentos de empleado', async () => {
    await assertSucceeds(getBytes(ref(member(), EMPLOYEE_DOC)))
    await assertSucceeds(
      uploadBytes(ref(member(), 'employees/companyA/emp2/contrato.pdf'), bytes(), {
        contentType: 'application/pdf',
      }),
    )
  })
})
