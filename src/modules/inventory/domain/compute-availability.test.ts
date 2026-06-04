import {
  availableFromPerUnit,
  computeProductAvailability,
  computePreparationAvailability,
} from './compute-availability'
import type { Recipe, RecipeComponent } from '../types'

// Factory mínimo: las funciones puras solo leen components/yieldQty/type/posProductKey.
function makeRecipe(partial: Partial<Recipe> & { components: RecipeComponent[] }): Recipe {
  return { id: 'r', type: 'product', active: true, ...partial } as Recipe
}

describe('availableFromPerUnit', () => {
  it('el insumo más escaso define el cuello de botella', () => {
    // pan: 320/1=320 ; carne: 4800/150=32 ; queso: 240/2=120 → carne manda
    const res = availableFromPerUnit(
      { pan: 1, carne: 150, queso: 2 },
      { pan: 320, carne: 4800, queso: 240 },
    )
    expect(res.units).toBe(32)
    expect(res.limitingItemId).toBe('carne')
    expect(res.blocked).toBe(false)
  })

  it('hace floor del mínimo ratio', () => {
    const res = availableFromPerUnit({ x: 3 }, { x: 10 }) // 10/3 = 3.33 → 3
    expect(res.units).toBe(3)
  })

  it('insumo faltante (stock 0 / ausente) → 0 y blocked', () => {
    const res = availableFromPerUnit({ pan: 1, carne: 150 }, { pan: 320 }) // carne ausente
    expect(res.units).toBe(0)
    expect(res.limitingItemId).toBe('carne')
    expect(res.blocked).toBe(true)
  })

  it('sin insumos requeridos → 0 y blocked', () => {
    const res = availableFromPerUnit({}, { pan: 100 })
    expect(res.units).toBe(0)
    expect(res.blocked).toBe(true)
  })

  it('ignora componentes con qty 0', () => {
    const res = availableFromPerUnit({ pan: 1, salsa: 0 }, { pan: 50 })
    expect(res.units).toBe(50)
    expect(res.limitingItemId).toBe('pan')
  })
})

describe('computeProductAvailability', () => {
  it('calcula porciones disponibles por producto y resuelve preparaciones anidadas', () => {
    // Salsa rinde 10 con 500ml mayonesa. Burger usa 2 porciones de salsa + 1 pan.
    // → por porción: pan 1, mayonesa 100ml.
    const salsa = makeRecipe({
      id: 'salsa',
      type: 'preparation',
      yieldQty: 10,
      components: [{ kind: 'item', refId: 'mayonesa', qty: 500 }],
    })
    const burger = makeRecipe({
      id: 'burger',
      type: 'product',
      posProductKey: { presentationId: 'p1', productGeneralId: 'g1', name: 'Burger' },
      components: [
        { kind: 'item', refId: 'pan', qty: 1 },
        { kind: 'preparation', refId: 'salsa', qty: 2 },
      ],
    })
    // pan: 30/1=30 ; mayonesa: 1000/100=10 → mayonesa manda → 10 porciones
    const rows = computeProductAvailability({
      recipes: [salsa, burger],
      preparationsById: { salsa },
      stock: { pan: 30, mayonesa: 1000 },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      presentationId: 'p1',
      name: 'Burger',
      available: 10,
      limitingItemId: 'mayonesa',
      blocked: false,
    })
  })

  it('ignora recetas de preparación y productos sin posProductKey', () => {
    const prep = makeRecipe({ id: 'prep', type: 'preparation', components: [{ kind: 'item', refId: 'x', qty: 1 }] })
    const noKey = makeRecipe({ id: 'nk', type: 'product', components: [{ kind: 'item', refId: 'y', qty: 1 }] })
    const rows = computeProductAvailability({ recipes: [prep, noKey], preparationsById: { prep }, stock: { x: 10, y: 10 } })
    expect(rows).toHaveLength(0)
  })

  it('ordena por disponibilidad ascendente (lo más escaso primero)', () => {
    const mk = (id: string, item: string, qty: number) =>
      makeRecipe({
        id,
        type: 'product',
        posProductKey: { presentationId: id, productGeneralId: id, name: id },
        components: [{ kind: 'item', refId: item, qty }],
      })
    const rows = computeProductAvailability({
      recipes: [mk('abundante', 'a', 1), mk('escaso', 'b', 100)],
      preparationsById: {},
      stock: { a: 1000, b: 100 }, // abundante=1000, escaso=1
    })
    expect(rows.map((r) => r.name)).toEqual(['escaso', 'abundante'])
  })
})

describe('computePreparationAvailability', () => {
  it('calcula lotes y porciones producibles', () => {
    // Salsa rinde 10 porciones con 500ml mayonesa por lote.
    const salsa = makeRecipe({
      id: 'salsa',
      type: 'preparation',
      name: 'Salsa Blue',
      yieldQty: 10,
      components: [{ kind: 'item', refId: 'mayonesa', qty: 500 }],
    })
    // stock 1500ml → floor(1500/500)=3 lotes → 30 porciones
    const rows = computePreparationAvailability({
      recipes: [salsa],
      preparationsById: { salsa },
      stock: { mayonesa: 1500 },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'Salsa Blue',
      yieldQty: 10,
      batches: 3,
      portions: 30,
      limitingItemId: 'mayonesa',
      blocked: false,
    })
  })

  it('aplica wasteFactor del lote', () => {
    const prep = makeRecipe({
      id: 'p',
      type: 'preparation',
      name: 'Mezcla',
      yieldQty: 1,
      components: [{ kind: 'item', refId: 'harina', qty: 100, wasteFactor: 0.25 }], // 125 efectivo
    })
    // 500/125 = 4 lotes
    const rows = computePreparationAvailability({ recipes: [prep], preparationsById: { prep }, stock: { harina: 500 } })
    expect(rows[0].batches).toBe(4)
  })

  it('preparación sin insumos suficientes → 0 lotes y blocked', () => {
    const prep = makeRecipe({
      id: 'p',
      type: 'preparation',
      name: 'Vacía',
      yieldQty: 5,
      components: [{ kind: 'item', refId: 'x', qty: 100 }],
    })
    const rows = computePreparationAvailability({ recipes: [prep], preparationsById: { prep }, stock: { x: 10 } })
    expect(rows[0]).toMatchObject({ batches: 0, portions: 0, blocked: true })
  })

  it('ignora recetas de producto', () => {
    const prod = makeRecipe({
      id: 'prod',
      type: 'product',
      posProductKey: { presentationId: 'p1', productGeneralId: 'g1', name: 'Burger' },
      components: [{ kind: 'item', refId: 'pan', qty: 1 }],
    })
    const rows = computePreparationAvailability({ recipes: [prod], preparationsById: {}, stock: { pan: 100 } })
    expect(rows).toHaveLength(0)
  })
})
