// Conecta una company al POS: escribe `posTenantId` y `posLocalId` en su doc.
//
// `posLocalId` es el override explícito que gana sobre el matching heurístico
// por nombre de `pos-company-mapping.ts`. Se necesita cuando el local en el POS
// no se llama como la `location` de la company — el caso original es Filipo
// San Lucas, cargada en el POS como "FILIPO POBLADO".
//
// Antes de escribir valida contra el POS que el local exista en el dominio del
// tenant, así un id mal tipeado falla acá y no en el cron a las 01:00.
//
// Uso (correr desde la raíz del repo; ADC vía `gcloud auth application-default login`):
//   node functions/scripts/set-company-pos-local.mjs --company <id> --tenant filipo --local 6
//   node functions/scripts/set-company-pos-local.mjs --company <id> --tenant filipo --local 6 --apply
//
// Sin --apply es dry run. Safe de re-correr.

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'empresas-bf'
const POS_PROXY_URL = process.env.POS_PROXY_URL || 'https://posproxy-xfyucmyk7q-uc.a.run.app'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return undefined
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : undefined
}

const companyId = arg('company')
const tenantId = arg('tenant')
const localRaw = arg('local')
const apply = process.argv.includes('--apply')

if (!companyId || !tenantId || localRaw === undefined) {
  console.error('Faltan argumentos: --company <id> --tenant <blue|filipo> --local <n> [--apply]')
  process.exit(1)
}

const localId = Number(localRaw)
if (!Number.isInteger(localId)) {
  console.error(`--local debe ser un entero (recibido: ${JSON.stringify(localRaw)})`)
  process.exit(1)
}

// El proxy acepta `tenantId` directo justamente para herramientas internas que
// no tienen una company ya mapeada (ver functions/src/pos-proxy.ts).
//
// Reintenta: el cold start del proxy corta la conexión con ECONNRESET cada
// tanto, y no vale la pena que el operador tenga que relanzar el script.
async function fetchLocales(attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(POS_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dominio', tenantId }),
      })
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}: ${await res.text()}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Proxy error')
      const tipo = Number(json.data?.tipo)
      if (tipo !== 1) {
        throw new Error((json.data?.mensajes || []).join(', ') || `POS error tipo ${tipo}`)
      }
      return json.data?.data?.locales ?? []
    } catch (err) {
      if (i >= attempts) throw err
      console.log(`  (intento ${i}/${attempts} falló: ${err.message}; reintentando en 5s)`)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
const db = getFirestore()

const ref = db.collection('companies').doc(companyId)
const snap = await ref.get()
if (!snap.exists) {
  console.error(`La company ${companyId} no existe en ${PROJECT_ID}`)
  process.exit(1)
}
const data = snap.data()

console.log(`Proyecto:  ${PROJECT_ID}`)
console.log(`Empresa:   ${companyId} — "${data.name}" / "${data.location}"`)
console.log(`Actual:    posTenantId=${JSON.stringify(data.posTenantId)} posLocalId=${JSON.stringify(data.posLocalId)}`)
console.log(`Objetivo:  posTenantId="${tenantId}" posLocalId=${localId}`)
console.log(`Dry run:   ${apply ? 'no (escribe)' : 'sí'}`)

console.log(`\nValidando el local contra el POS (tenant ${tenantId})...`)
const locales = await fetchLocales()
for (const l of locales) {
  const mark = Number(l.local_id) === localId ? '→' : ' '
  console.log(`  ${mark} local_id=${l.local_id}  "${l.local_descripcion}"`)
}
const target = locales.find((l) => Number(l.local_id) === localId)
if (!target) {
  console.error(
    `\n✖ El local ${localId} no existe en el dominio del tenant "${tenantId}". Nada que escribir.`,
  )
  process.exit(2)
}

// Un mismo local no puede pertenecer a dos companies: sería doble contabilidad
// de las mismas ventas en el Home y en los informes.
const dupes = await db.collection('companies').where('posLocalId', '==', localId).get()
const conflict = dupes.docs.find((d) => d.id !== companyId && d.data().posTenantId === tenantId)
if (conflict) {
  console.error(
    `\n✖ El local ${localId} del tenant "${tenantId}" ya está asignado a ` +
      `${conflict.id} ("${conflict.data().name}" / "${conflict.data().location}"). Nada que escribir.`,
  )
  process.exit(2)
}

if (data.posTenantId === tenantId && data.posLocalId === localId) {
  console.log('\n✓ El doc ya está así. Nada que hacer.')
  process.exit(0)
}

if (!apply) {
  console.log(`\n[dry-run] Escribiría posTenantId="${tenantId}" posLocalId=${localId}. Repetí con --apply.`)
  process.exit(0)
}

await ref.update({ posTenantId: tenantId, posLocalId: localId })
const after = (await ref.get()).data()
console.log(
  `\n✓ Escrito — posTenantId=${JSON.stringify(after.posTenantId)} posLocalId=${JSON.stringify(after.posLocalId)} ("${target.local_descripcion}")`,
)
console.log(
  'Las Cloud Functions cachean el tenant de cada company 15 min; el cambio se propaga solo.',
)
process.exit(0)
