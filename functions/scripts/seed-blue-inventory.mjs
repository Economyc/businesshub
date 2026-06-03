// One-shot: siembra el catalogo de Insumos + Subrecetas (preparaciones) del
// Recetario Operativo Blue Smash Burger en el modulo de Inventarios, para los
// dos locales Blue (Manila + Escondite). Calcado de
// seed-blue-escondite-employees.mjs: corre con Application Default Credentials
// (gcloud auth application-default login).
//
// Uso (desde functions/):
//   node scripts/seed-blue-inventory.mjs          # DRY RUN (no escribe)
//   node scripts/seed-blue-inventory.mjs --write  # aplica cambios
//
// Idempotente: usa ids deterministas (inv_<slug>, prep_<slug>) y omite (SKIP)
// cualquier doc cuyo id ya exista en la company.
//
// Modelo (src/modules/inventory/types.ts + domain/explode-recipe.ts):
//   - InventoryItem: { name, category, stockUnit, purchaseUnit,
//       purchaseToStockFactor, active }  (unitCost/parLevel/... los pone el
//       usuario despues en la UI).
//   - Recipe(preparacion): { type:'preparation', name, yieldQty, components[],
//       active }.
//   - RecipeComponent: { kind:'item'|'preparation', refId, qty, wasteFactor? }.
//     * kind='item'        -> qty en unidad de stock (gramos del recetario, NETO)
//     * kind='preparation' -> qty en PORCIONES (subPortions = qty / yieldQty)
//     * wasteFactor = Factor(recetario) - 1 (Factor = bruto/neto = merma)

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp({
  credential: applicationDefault(),
  projectId: 'empresas-bf',
})

const db = getFirestore()
const DRY = !process.argv.includes('--write')

function norm(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function slug(s) {
  return norm(s)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const itemId = (name) => `inv_${slug(name)}`
const prepId = (name) => `prep_${slug(name)}`

// --- Insumos: [nombre, categoria] ----------------------------------------
const ITEMS = [
  ['Pan de papa', 'Panadería'],
  ['Mantequilla', 'Lácteos'],
  ['Tomate chonto', 'Vegetales'],
  ['Cogollo europeo', 'Vegetales'],
  ['Queso americano KRAFT', 'Lácteos'],
  ['Cebolla blanca', 'Vegetales'],
  ['Salsa de tomate', 'Condimentos y salsas'],
  ['Mostaza frenchis', 'Condimentos y salsas'],
  ['Mayonesa', 'Condimentos y salsas'],
  ['Salsa BBQ', 'Condimentos y salsas'],
  ['Pepinillos agridulces', 'Condimentos y salsas'],
  ['Cebolla crispy', 'Abarrotes'],
  ['Papas francesas 7x7', 'Congelados'],
  ['Aceite freir super fry', 'Abarrotes'],
  ['Miel de abejas', 'Abarrotes'],
  ['Helado de vainilla', 'Congelados'],
  ['Leche entera', 'Lácteos'],
  ['Helado de chocolate', 'Congelados'],
  ['Sal fina', 'Condimentos y salsas'],
  ['Pimienta negra molida', 'Condimentos y salsas'],
  ['Pecho de res molido', 'Cárnicos'],
  ['Tocineta economica', 'Cárnicos'],
  ['Harina de trigo', 'Abarrotes'],
  ['Huevo entero', 'Lácteos'],
  ['Panko', 'Abarrotes'],
  ['Queso mozzarella', 'Lácteos'],
  ['Paprika', 'Condimentos y salsas'],
  ['Agua corriente', 'Bebidas'],
  ['Miga de pan', 'Panadería'],
  ['Hojuelas de maiz', 'Abarrotes'],
  ['Panela en polvo', 'Abarrotes'],
  ['Repollo morado', 'Vegetales'],
  ['Salsa worcestershire frenchs', 'Condimentos y salsas'],
  ['Vinagre blanco', 'Condimentos y salsas'],
  ['Vino sauvignon blanc', 'Bebidas'],
  ['Estragon fresco', 'Vegetales'],
  ['Perejil liso fresco', 'Vegetales'],
  ['Albahaca fresca', 'Vegetales'],
  ['Nuez moscada en polvo', 'Condimentos y salsas'],
  ['Marañones tostados', 'Abarrotes'],
  ['Alcaparras', 'Abarrotes'],
  ['Crema de leche', 'Lácteos'],
  ['Limon tahiti jugo', 'Frutas'],
  ['Salsa agridulce', 'Condimentos y salsas'],
  ['Peperoncino', 'Condimentos y salsas'],
  ['Tabasco', 'Condimentos y salsas'],
  ['Repollo blanco', 'Vegetales'],
  ['Zanahoria', 'Vegetales'],
  ['Queso crema', 'Lácteos'],
  ['Batata', 'Vegetales'],
  ['Soda', 'Bebidas'],
  ['Polvo de hornear', 'Abarrotes'],
  ['Cerveza rubia', 'Bebidas'],
  ['Ajo fresco pelado', 'Vegetales'],
  ['Queso parmesano', 'Lácteos'],
  ['Pollo pechuga', 'Cárnicos'],
  ['Curry polvo', 'Condimentos y salsas'],
  ['Jengibre fresco', 'Vegetales'],
  ['Cebolla en pasta', 'Condimentos y salsas'],
  ['Caldo en polvo', 'Condimentos y salsas'],
  ['Papa capira', 'Vegetales'],
]

// --- Preparaciones --------------------------------------------------------
// Helpers para declarar componentes:
//   it(name, qty, waste?) -> componente insumo (qty en gramos)
//   pr(prepName, qty)     -> componente preparacion (qty en PORCIONES)
const it = (name, qty, waste = 0) => ({ kind: 'item', ref: name, qty, waste })
const pr = (name, qty) => ({ kind: 'preparation', ref: name, qty, waste: 0 })

const PREPARATIONS = [
  { name: 'Sal pimienta', yieldQty: 710, components: [
    it('Sal fina', 700), it('Pimienta negra molida', 10),
  ] },
  { name: 'Carne de hamburguesa', yieldQty: 10, components: [
    it('Pecho de res molido', 1000),
  ] },
  { name: 'Tocineta tostada', yieldQty: 30, components: [
    it('Tocineta economica', 1000),
  ] },
  { name: 'Pollo apanado', yieldQty: 1, components: [
    pr('Pollo marinado', 0.9), it('Harina de trigo', 5), it('Huevo entero', 15, 0.20),
    it('Panko', 20), it('Aceite freir super fry', 30), pr('Sal paprika', 1),
  ] },
  { name: 'Queso apanado', yieldQty: 4.40, components: [
    it('Queso mozzarella', 80), pr('Sal paprika', 11), it('Harina de trigo', 5),
    it('Huevo entero', 15, 0.20), it('Panko', 20), it('Aceite freir super fry', 30),
  ] },
  { name: 'Sal paprika', yieldQty: 60, components: [
    it('Sal fina', 500), it('Paprika', 150), it('Pimienta negra molida', 10),
    it('Agua corriente', 450),
  ] },
  { name: 'Mezcla de migas', yieldQty: 35, components: [
    it('Miga de pan', 400), it('Hojuelas de maiz', 600), it('Paprika', 20),
  ] },
  { name: 'Mermelada de tocineta', yieldQty: 6.67, components: [
    it('Tocineta economica', 900), it('Sal fina', 3), it('Panela en polvo', 195),
    it('Repollo morado', 300, 0.33), it('Agua corriente', 90),
    it('Salsa worcestershire frenchs', 60), it('Vinagre blanco', 75),
  ] },
  { name: 'Salsa entrecote', yieldQty: 35, components: [
    it('Mantequilla', 375), it('Cebolla blanca', 225, 0.11), it('Vino sauvignon blanc', 45),
    it('Estragon fresco', 25, 0.43), it('Perejil liso fresco', 30, 0.25),
    it('Albahaca fresca', 10, 0.11), it('Nuez moscada en polvo', 3),
    it('Marañones tostados', 30), it('Alcaparras', 30), it('Pimienta negra molida', 0.5),
    it('Sal fina', 9), it('Crema de leche', 150), it('Limon tahiti jugo', 15, 1.86),
    it('Huevo entero', 90, 0.20), it('Mostaza frenchis', 30), it('Vinagre blanco', 23),
    it('Salsa worcestershire frenchs', 21),
  ] },
  { name: 'Papas entrecote', yieldQty: 20, components: [
    it('Papa capira', 1000, 0.32), it('Aceite freir super fry', 100), pr('Sal paprika', 5),
  ] },
  { name: 'Salsa agridulce de chiles', yieldQty: 32.75, components: [
    it('Mayonesa', 400), it('Salsa agridulce', 250), it('Peperoncino', 5),
  ] },
  { name: 'Picadillo de cebolla', yieldQty: 43.33, components: [
    it('Pepinillos agridulces', 300), it('Cebolla blanca', 350, 0.11),
    it('Sal fina', 3), it('Panela en polvo', 3),
  ] },
  { name: 'Salsa blue', yieldQty: 85, components: [
    it('Mayonesa', 500), it('Salsa de tomate', 250), it('Mostaza frenchis', 160),
    it('Salsa agridulce', 175), it('Pepinillos agridulces', 150), it('Paprika', 5),
    it('Pimienta negra molida', 1), it('Tabasco', 5),
  ] },
  { name: 'Slaw', yieldQty: 35, components: [
    it('Repollo morado', 200, 0.33), it('Repollo blanco', 150, 0.33),
    it('Cebolla blanca', 50, 0.11), it('Zanahoria', 80, 0.18), it('Queso crema', 100),
    it('Mayonesa', 40), it('Limon tahiti jugo', 25, 1.86), it('Mostaza frenchis', 20),
    it('Panela en polvo', 15), it('Tabasco', 1), it('Sal fina', 5),
  ] },
  { name: 'Batatas fritas', yieldQty: 1, components: [
    it('Batata', 50, 0.33), pr('Apanador', 0.6), it('Aceite freir super fry', 10),
  ] },
  { name: 'Apanador', yieldQty: 4, components: [
    pr('Sal paprika', 16), it('Soda', 50), it('Polvo de hornear', 4),
    it('Harina de trigo', 180), it('Cerveza rubia', 200),
  ] },
  { name: 'Alioli de parmesano', yieldQty: 26.67, components: [
    it('Ajo fresco pelado', 30, 0.11), it('Queso parmesano', 60), it('Vinagre blanco', 40),
    it('Aceite freir super fry', 300), it('Mostaza frenchis', 40), it('Mayonesa', 300),
    it('Sal fina', 2), it('Limon tahiti jugo', 25, 1.86),
  ] },
  { name: 'Pollo marinado', yieldQty: 30, components: [
    it('Pollo pechuga', 3000, 0.25), it('Vino sauvignon blanc', 300), it('Curry polvo', 5),
    it('Mostaza frenchis', 60), it('Pimienta negra molida', 5), it('Jengibre fresco', 15, 0.33),
    it('Sal fina', 40), it('Cebolla en pasta', 30), it('Ajo fresco pelado', 30, 0.11),
    it('Caldo en polvo', 4), it('Paprika', 5),
  ] },
]

// --- Validacion de integridad referencial (antes de tocar Firestore) ------
const itemNames = new Set(ITEMS.map(([n]) => norm(n)))
const prepNames = new Set(PREPARATIONS.map((p) => norm(p.name)))
let refErrors = 0
for (const p of PREPARATIONS) {
  for (const c of p.components) {
    const known = c.kind === 'item' ? itemNames.has(norm(c.ref)) : prepNames.has(norm(c.ref))
    if (!known) {
      console.error(`[seed] ERROR ref no resuelta en "${p.name}": ${c.kind} "${c.ref}"`)
      refErrors++
    }
  }
}
if (refErrors > 0) {
  console.error(`[seed] ABORT: ${refErrors} referencia(s) sin resolver.`)
  process.exit(1)
}

function buildComponents(p) {
  return p.components.map((c) => {
    const refId = c.kind === 'item' ? itemId(c.ref) : prepId(c.ref)
    const out = { kind: c.kind, refId, qty: c.qty }
    if (c.waste > 0) out.wasteFactor = c.waste // admin SDK no ignora undefined
    return out
  })
}

// --- Resolver las companies Blue -----------------------------------------
const companiesSnap = await db.collection('companies').get()
const blue = companiesSnap.docs.filter((d) => norm(d.data().name).includes('blue'))

if (blue.length === 0) {
  console.error('[seed] ERROR: no encontre ninguna empresa Blue.')
  process.exit(1)
}
console.log(`[seed] companies Blue encontradas: ${blue.length} (dry=${DRY})`)
for (const c of blue) {
  console.log(`  - id=${c.id} name="${c.data().name}" location="${c.data().location ?? ''}"`)
}

// --- Sembrar cada company -------------------------------------------------
let totalItems = 0
let totalPreps = 0

for (const company of blue) {
  const companyId = company.id
  const label = `${company.data().name} / ${company.data().location ?? ''}`
  console.log(`\n[seed] === ${label} (id=${companyId}) ===`)

  const itemsRef = db.collection('companies').doc(companyId).collection('inventoryItems')
  const recipesRef = db.collection('companies').doc(companyId).collection('recipes')

  const existingItemIds = new Set((await itemsRef.get()).docs.map((d) => d.id))
  const existingRecipeIds = new Set((await recipesRef.get()).docs.map((d) => d.id))

  // Insumos
  let cI = 0
  let sI = 0
  for (const [name, category] of ITEMS) {
    const id = itemId(name)
    if (existingItemIds.has(id)) {
      sI++
      continue
    }
    const now = Timestamp.now()
    const doc = {
      name,
      category,
      stockUnit: 'g',
      purchaseUnit: 'gramos',
      purchaseToStockFactor: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    if (DRY) {
      console.log(`[seed] DRY   ITEM  "${name}" (${category}) -> ${id}`)
    } else {
      await itemsRef.doc(id).set(doc)
      console.log(`[seed] WRITE ITEM  "${name}" -> ${id}`)
    }
    cI++
  }
  console.log(`[seed] insumos: created=${cI} skipped=${sI}`)
  totalItems += cI

  // Preparaciones
  let cP = 0
  let sP = 0
  for (const p of PREPARATIONS) {
    const id = prepId(p.name)
    if (existingRecipeIds.has(id)) {
      sP++
      continue
    }
    const now = Timestamp.now()
    const doc = {
      type: 'preparation',
      name: p.name,
      yieldQty: p.yieldQty,
      components: buildComponents(p),
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    if (DRY) {
      console.log(`[seed] DRY   PREP  "${p.name}" (yield=${p.yieldQty}, ${doc.components.length} comps) -> ${id}`)
    } else {
      await recipesRef.doc(id).set(doc)
      console.log(`[seed] WRITE PREP  "${p.name}" -> ${id}`)
    }
    cP++
  }
  console.log(`[seed] preparaciones: created=${cP} skipped=${sP}`)
  totalPreps += cP
}

console.log(`\n[seed] done — insumos creados=${totalItems} preparaciones creadas=${totalPreps} dry=${DRY}`)
process.exit(0)
