// One-shot: siembra las recetas de PRODUCTO (type='product') del Recetario
// Operativo Blue Smash Burger en el modulo de Inventarios, conectando cada
// producto vendible del POS con sus insumos + subrecetas ya sembradas por
// seed-blue-inventory.mjs. Calcado de ese script: corre con Application Default
// Credentials (gcloud auth application-default login).
//
// Uso (desde functions/):
//   node scripts/seed-blue-products.mjs          # DRY RUN (no escribe)
//   node scripts/seed-blue-products.mjs --write  # aplica cambios
//
// Resuelve el presentationId REAL del POS por-local (consulta el catalogo de
// cada company). Idempotente: SKIP si ya existe una receta con ese
// posProductKey.presentationId en la company (cubre re-runs y recetas creadas
// a mano, ej. las 2 Coca Cola de Manila).
//
// Modelo (src/modules/inventory/types.ts + domain/explode-recipe.ts):
//   - Recipe(producto): { type:'product', posProductKey:{presentationId,
//       productGeneralId, name}, components[], active }.
//   - RecipeComponent: { kind:'item'|'preparation', refId, qty, wasteFactor? }.
//     * kind='item'        -> qty en unidad de stock (gramos del recetario, NETO)
//                             wasteFactor = Factor(recetario) - 1
//     * kind='preparation' -> qty en PORCIONES (= neto / pesoXporcion de la sub)
//   - refId = inv_<slug(nombre)> (insumo) | prep_<slug(nombre)> (subreceta).

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp({
  credential: applicationDefault(),
  projectId: 'empresas-bf',
})

const db = getFirestore()
const DRY = !process.argv.includes('--write')
const POS_PROXY = 'https://businesshub.myvnc.com/api/pos'

function norm(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
const itemId = (name) => `inv_${slug(name)}`
const prepId = (name) => `prep_${slug(name)}`

// Helpers de componentes (mismos que seed-blue-inventory.mjs).
//   it(name, neto, waste?) -> componente insumo (qty en gramos NETO)
//   pr(name, porciones)    -> componente preparacion (qty en PORCIONES)
const it = (name, neto, waste = 0) => ({ kind: 'item', ref: name, qty: neto, waste })
const pr = (name, porciones) => ({ kind: 'preparation', ref: name, qty: porciones, waste: 0 })

// --- 14 productos principales (gramajes EXACTOS del Excel V210526) ----------
// `pos` = productogeneral_descripcion canonico del POS (match por nombre).
const PRODUCTS = [
  { pos: 'FANCY', src: 'FUE1 Smash fancy', components: [
    it('Pan de papa', 70),
    it('Mantequilla', 10),
    pr('Salsa blue', 1.3333) /* 20g / 15g */,
    it('Tomate chonto', 20, 0.25),
    it('Cogollo europeo', 10, 0.25),
    pr('Carne de hamburguesa', 1.0) /* 100g / 100g */,
    it('Queso americano KRAFT', 20),
    pr('Tocineta tostada', 1.0) /* 10g / 10g */,
    it('Cebolla blanca', 10, 0.1111),
    it('Salsa de tomate', 15),
  ] },
  { pos: 'CLASICA CHEESE BURGUER', src: 'FUE2 Smash super clasica', components: [
    it('Pan de papa', 70),
    it('Mantequilla', 10),
    it('Salsa de tomate', 30),
    pr('Carne de hamburguesa', 1.0) /* 100g / 100g */,
    pr('Tocineta tostada', 1.0) /* 10g / 10g */,
    it('Queso americano KRAFT', 20),
    pr('Picadillo de cebolla', 1.3333) /* 20g / 15g */,
    it('Mostaza frenchis', 10),
  ] },
  { pos: 'POLLO', src: 'FUE3 Smash pollo', components: [
    it('Pan de papa', 70),
    it('Mantequilla', 10),
    it('Mayonesa', 5),
    pr('Salsa agridulce de chiles', 1.25) /* 25g / 20g */,
    pr('Pollo apanado', 0.9735) /* 110g / 113g */,
    it('Queso americano KRAFT', 1),
    it('Cebolla blanca', 10, 0.1111),
    it('Tomate chonto', 20, 0.25),
    it('Cogollo europeo', 10, 0.25),
  ] },
  { pos: 'OKLAHOMA', src: 'FUE4 Smash oklahoma', components: [
    it('Pan de papa', 70),
    it('Mantequilla', 10),
    it('Mayonesa', 5),
    it('Salsa de tomate', 5),
    it('Cebolla blanca', 20, 0.1111),
    it('Queso americano KRAFT', 20),
    pr('Carne de hamburguesa', 1.0) /* 100g / 100g */,
    it('Pepinillos agridulces', 15),
    it('Mostaza frenchis', 5),
  ] },
  { pos: 'ENTRECOTE', src: 'FUE5 Smash entrecote', components: [
    it('Pan de papa', 70),
    it('Mantequilla', 10),
    pr('Salsa entrecote', 1.0) /* 30g / 30g */,
    pr('Papas entrecote', 1.0) /* 50g / 50g */,
    pr('Carne de hamburguesa', 1.0) /* 100g / 100g */,
    it('Queso americano KRAFT', 20),
    it('Mayonesa', 5),
    it('Mostaza frenchis', 5),
    it('Salsa de tomate', 5),
  ] },
  { pos: 'BBQ CRISPY', src: 'FUE6 BBQ crispy smash', components: [
    it('Pan de papa', 70),
    it('Mantequilla', 10),
    it('Cebolla crispy', 20, 0.1111),
    pr('Carne de hamburguesa', 1.0) /* 100g / 100g */,
    it('Queso americano KRAFT', 20),
    pr('Tocineta tostada', 1.0) /* 10g / 10g */,
    it('Salsa BBQ', 15),
    it('Mayonesa', 15),
  ] },
  { pos: 'RED SMASH', src: 'FUE7 Red smash', components: [
    it('Pan de papa', 70),
    it('Mantequilla', 10),
    pr('Mermelada de tocineta', 0.6667) /* 20g / 30g */,
    pr('Carne de hamburguesa', 1.0) /* 100g / 100g */,
    it('Queso americano KRAFT', 20),
    it('Mayonesa', 15),
    it('Salsa de tomate', 15),
  ] },
  { pos: 'NUGGETS', src: 'FUE8 Nuggets de pollos', components: [
    pr('Pollo apanado', 1.6814) /* 190g / 113g */,
    pr('Sal paprika', 1.0) /* 1g / 1g */,
    pr('Alioli de parmesano', 1.0) /* 30g / 30g */,
    it('Papas francesas 7x7', 160),
    it('Aceite freir super fry', 30),
  ] },
  { pos: 'MOZARELLA STICKS', src: 'FUE9 Nuggets de queso & papas', components: [
    pr('Queso apanado', 2.4) /* 60g / 25g */,
    it('Papas francesas 7x7', 160),
    pr('Sal paprika', 1.0) /* 1g / 1g */,
    it('Miel de abejas', 30),
    it('Aceite freir super fry', 30),
  ] },
  { pos: 'MEAT FRIES', src: 'FUE10 Papas con carne', components: [
    it('Papas francesas 7x7', 200),
    it('Aceite freir super fry', 20),
    pr('Sal paprika', 1.0) /* 1g / 1g */,
    pr('Salsa blue', 2.0) /* 30g / 15g */,
    pr('Carne de hamburguesa', 1.0) /* 100g / 100g */,
    it('Queso americano KRAFT', 40),
    it('Cebolla crispy', 20, 0.1111),
    it('Salsa BBQ', 20),
  ] },
  { pos: 'CHICKEN FRIES', src: 'FUE11 Papas con pollo apanado', components: [
    it('Papas francesas 7x7', 200),
    it('Aceite freir super fry', 20),
    pr('Sal paprika', 1.0) /* 1g / 1g */,
    pr('Alioli de parmesano', 1.0) /* 30g / 30g */,
    pr('Pollo apanado', 1.5929) /* 180g / 113g */,
    it('Queso americano KRAFT', 40),
    pr('Mermelada de tocineta', 0.6667) /* 20g / 30g */,
    pr('Salsa blue', 2.0) /* 30g / 15g */,
  ] },
  { pos: 'PAPAS A LA FRANCESA', src: 'FUE12 Papas a la francesa', components: [
    it('Papas francesas 7x7', 160),
    it('Aceite freir super fry', 20),
    pr('Sal paprika', 1.0) /* 1g / 1g */,
    pr('Alioli de parmesano', 1.0) /* 30g / 30g */,
  ] },
  { pos: 'VAINILLA', src: 'BEB1 Vanilla (malteada)', components: [
    it('Helado de vainilla', 200),
    it('Leche entera', 100),
  ] },
  { pos: 'CHOCOLATE', src: 'BEB2 Chocolate (malteada)', components: [
    it('Helado de chocolate', 200),
    it('Leche entera', 100),
  ] },
]

// --- Adiciones vendibles (1 componente c/u) --------------------------------
// Gramaje NO esta en el recetario: defaults razonables (editables en UI). El
// refId es lo critico. Las ausentes en un local se omiten solas.
const ADICIONES = [
  { pos: 'CARNE', components: [pr('Carne de hamburguesa', 1.0)] },
  { pos: 'POLLO APANADO', components: [pr('Pollo apanado', 1.0)] },
  { pos: 'TOCINETA', components: [pr('Tocineta tostada', 3.0)] }, // 30g / 10g  (confirmar)
  { pos: 'QUESO AMERICANO', components: [it('Queso americano KRAFT', 20)] },
  { pos: 'CEBOLLA', components: [it('Cebolla crispy', 20, 0.1111)] }, // crispy (decidido por usuario)
  { pos: 'TOMATE', components: [it('Tomate chonto', 20, 0.25)] },
  { pos: 'PEPINILLOS', components: [it('Pepinillos agridulces', 15)] },
  { pos: 'COGOLLO EUROPEO', components: [it('Cogollo europeo', 20, 0.25)] },
  { pos: 'ALIOLI', components: [pr('Alioli de parmesano', 1.0)] },
  { pos: 'ENTRECOTE SALSA', components: [pr('Salsa entrecote', 1.0)] },
  { pos: 'MERMELADA DE TOCINETA', components: [pr('Mermelada de tocineta', 1.0)] },
  { pos: 'PICADILLO', components: [pr('Picadillo de cebolla', 1.3333)] },
]

const ALL = [
  ...PRODUCTS.map((p) => ({ ...p, kind: 'PROD' })),
  ...ADICIONES.map((p) => ({ ...p, src: `adicion ${p.pos}`, kind: 'ADIC' })),
]

function buildComponents(p) {
  return p.components.map((c) => {
    const refId = c.kind === 'item' ? itemId(c.ref) : prepId(c.ref)
    const out = { kind: c.kind, refId, qty: c.qty }
    if (c.waste > 0) out.wasteFactor = c.waste // admin SDK no ignora undefined
    return out
  })
}

// --- POS ------------------------------------------------------------------
async function posCall(companyId, action, params) {
  const res = await fetch(POS_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, companyId, params }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'POS proxy error')
  if (Number(json.data?.tipo) !== 1) {
    throw new Error(json.data?.mensajes?.join(', ') || `POS tipo ${json.data?.tipo}`)
  }
  return json.data.data
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Mapa normalize(descripcion) -> { presentationId, productGeneralId, name }.
async function buildCatalogMap(companyId, localId) {
  const raw = await posCall(companyId, 'catalogo', { local_id: localId })
  const prods = Array.isArray(raw) ? raw : Object.values(raw)
  const map = new Map()
  for (const p of prods) {
    const name = String(p.productogeneral_descripcion ?? '')
    const key = norm(name)
    const pres = (p.lista_presentacion ?? [])[0]
    if (!pres) continue
    if (map.has(key)) {
      console.warn(`[seed]   ! nombre POS duplicado, uso el primero: "${name}"`)
      continue
    }
    map.set(key, {
      presentationId: String(pres.producto_id ?? ''),
      productGeneralId: String(p.productogeneral_id ?? ''),
      name,
    })
  }
  return map
}

// --- Resolver companies Blue + su local_id --------------------------------
const companiesSnap = await db.collection('companies').get()
const blue = companiesSnap.docs.filter((d) => norm(d.data().name).includes('blue'))
if (blue.length === 0) {
  console.error('[seed] ERROR: no encontre ninguna empresa Blue.')
  process.exit(1)
}

// Locales del tenant (mismo para ambas companies Blue).
const dominio = await posCall(blue[0].id, 'dominio')
const locales = dominio.locales ?? []
function localIdFor(company) {
  const loc = norm(company.data().location ?? '')
  const m = locales.find((l) => norm(l.local_descripcion ?? '').includes(loc) && loc)
  return m ? Number(m.local_id) : null
}

console.log(`[seed] companies Blue: ${blue.length} (dry=${DRY})`)

// --- Sembrar cada company -------------------------------------------------
let grandWrite = 0
let grandSkip = 0
let grandMiss = 0

for (const company of blue) {
  const companyId = company.id
  const localId = localIdFor(company)
  const label = `${company.data().name} / ${company.data().location ?? ''}`
  console.log(`\n[seed] === ${label} (id=${companyId}, local_id=${localId}) ===`)
  if (localId == null) {
    console.error(`[seed]   ! sin local_id POS para "${label}", se omite la company.`)
    continue
  }

  const itemsRef = db.collection('companies').doc(companyId).collection('inventoryItems')
  const recipesRef = db.collection('companies').doc(companyId).collection('recipes')

  const existingItemIds = new Set((await itemsRef.get()).docs.map((d) => d.id))
  const recipesSnap = await recipesRef.get()
  const existingRecipeIds = new Set(recipesSnap.docs.map((d) => d.id))
  const existingPresIds = new Set(
    recipesSnap.docs
      .map((d) => d.data()?.posProductKey?.presentationId)
      .filter((x) => x != null)
      .map(String),
  )

  const catalog = await buildCatalogMap(companyId, localId)
  await wait(6000) // cooldown POS antes del proximo local

  let cW = 0
  let cS = 0
  let cM = 0
  for (const prod of ALL) {
    const hit = catalog.get(norm(prod.pos))
    if (!hit) {
      cM++
      console.log(`[seed]   MISS  ${prod.kind} "${prod.pos}" (${prod.src}) — no esta en el catalogo de este local`)
      continue
    }

    // Validacion referencial: todo refId debe existir.
    const components = buildComponents(prod)
    const bad = components.filter((c) =>
      c.kind === 'item' ? !existingItemIds.has(c.refId) : !existingRecipeIds.has(c.refId),
    )
    if (bad.length) {
      console.error(`[seed]   ERROR ref(s) inexistente(s) en "${prod.pos}": ${bad.map((b) => b.refId).join(', ')}`)
      process.exit(1)
    }

    const id = `prod_${hit.presentationId}`
    if (existingRecipeIds.has(id) || existingPresIds.has(hit.presentationId)) {
      cS++
      console.log(`[seed]   SKIP  ${prod.kind} "${prod.pos}" -> pres=${hit.presentationId} (ya existe)`)
      continue
    }

    const now = Timestamp.now()
    const doc = {
      type: 'product',
      posProductKey: {
        presentationId: hit.presentationId,
        productGeneralId: hit.productGeneralId,
        name: hit.name,
      },
      components,
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    if (DRY) {
      console.log(`[seed]   DRY   ${prod.kind} "${prod.pos}" -> ${id} (pres=${hit.presentationId}, ${components.length} comps)`)
    } else {
      await recipesRef.doc(id).set(doc)
      console.log(`[seed]   WRITE ${prod.kind} "${prod.pos}" -> ${id}`)
    }
    cW++
  }
  console.log(`[seed]   resumen ${label}: write=${cW} skip=${cS} miss=${cM}`)
  grandWrite += cW
  grandSkip += cS
  grandMiss += cM
}

console.log(`\n[seed] done — write=${grandWrite} skip=${grandSkip} miss=${grandMiss} dry=${DRY}`)
process.exit(0)
