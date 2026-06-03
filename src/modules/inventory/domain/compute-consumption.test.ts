import { computeConsumption, type ConsumptionSaleLine } from './compute-consumption'
import type { Recipe, RecipeComponent } from '../types'

// Factory mínimo: las funciones puras solo leen components/yieldQty/type/posProductKey.
function makeRecipe(partial: Partial<Recipe> & { components: RecipeComponent[] }): Recipe {
  return { id: 'r', type: 'product', active: true, ...partial } as Recipe
}

function line(partial: Partial<ConsumptionSaleLine> & { presentationId: string }): ConsumptionSaleLine {
  return { productName: '', qty: 1, lineRevenue: 0, ...partial }
}

describe('computeConsumption', () => {
  it('explota una venta con insumos directos por las porciones vendidas', () => {
    const burger = makeRecipe({
      posProductKey: { presentationId: 'p1', productGeneralId: 'g1', name: 'Burger' },
      components: [
        { kind: 'item', refId: 'pan', qty: 1 },
        { kind: 'item', refId: 'carne', qty: 150 },
      ],
    })
    const res = computeConsumption({
      saleLines: [line({ presentationId: 'p1', qty: 2 })],
      recipeByPresentation: new Map([['p1', burger]]),
      preparationsById: {},
    })
    expect(res.consumption).toEqual({ pan: 2, carne: 300 })
    expect(res.unmapped).toEqual([])
    expect(res.portionsByPresentation).toEqual({ p1: 2 })
  })

  it('suma dos ventas del mismo producto', () => {
    const r = makeRecipe({
      posProductKey: { presentationId: 'p1', productGeneralId: 'g1', name: 'Burger' },
      components: [{ kind: 'item', refId: 'carne', qty: 100 }],
    })
    const res = computeConsumption({
      saleLines: [line({ presentationId: 'p1', qty: 1 }), line({ presentationId: 'p1', qty: 3 })],
      recipeByPresentation: new Map([['p1', r]]),
      preparationsById: {},
    })
    expect(res.consumption).toEqual({ carne: 400 })
    expect(res.portionsByPresentation).toEqual({ p1: 4 })
  })

  it('agrega un insumo compartido por dos productos distintos', () => {
    const a = makeRecipe({
      posProductKey: { presentationId: 'pa', productGeneralId: 'ga', name: 'A' },
      components: [{ kind: 'item', refId: 'sal', qty: 5 }],
    })
    const b = makeRecipe({
      posProductKey: { presentationId: 'pb', productGeneralId: 'gb', name: 'B' },
      components: [{ kind: 'item', refId: 'sal', qty: 2 }],
    })
    const res = computeConsumption({
      saleLines: [line({ presentationId: 'pa', qty: 1 }), line({ presentationId: 'pb', qty: 2 })],
      recipeByPresentation: new Map([['pa', a], ['pb', b]]),
      preparationsById: {},
    })
    expect(res.consumption).toEqual({ sal: 5 + 4 })
  })

  it('explota preparaciones anidadas escaladas por la cantidad vendida', () => {
    const salsa = makeRecipe({
      id: 'salsa',
      type: 'preparation',
      yieldQty: 10,
      components: [{ kind: 'item', refId: 'mayonesa', qty: 500 }],
    })
    const burger = makeRecipe({
      posProductKey: { presentationId: 'p1', productGeneralId: 'g1', name: 'Burger' },
      components: [{ kind: 'preparation', refId: 'salsa', qty: 2 }],
    })
    // 3 burgers × 2 porciones de salsa = 6/10 de la receta → 300 ml mayonesa.
    const res = computeConsumption({
      saleLines: [line({ presentationId: 'p1', qty: 3 })],
      recipeByPresentation: new Map([['p1', burger]]),
      preparationsById: { salsa },
    })
    expect(res.consumption.mayonesa).toBeCloseTo(300, 6)
  })

  it('reporta productos sin receta en unmapped y no en consumption', () => {
    const res = computeConsumption({
      saleLines: [line({ presentationId: 'x', productName: 'Postre', qty: 2, lineRevenue: 20000 })],
      recipeByPresentation: new Map(),
      preparationsById: {},
    })
    expect(res.consumption).toEqual({})
    expect(res.unmapped).toEqual([
      { presentationId: 'x', productName: 'Postre', units: 2, revenue: 20000 },
    ])
  })

  it('mezcla mapeado y no mapeado en el mismo set', () => {
    const r = makeRecipe({
      posProductKey: { presentationId: 'p1', productGeneralId: 'g1', name: 'Burger' },
      components: [{ kind: 'item', refId: 'carne', qty: 100 }],
    })
    const res = computeConsumption({
      saleLines: [
        line({ presentationId: 'p1', qty: 1 }),
        line({ presentationId: 'x', productName: 'Postre', qty: 1, lineRevenue: 5000 }),
      ],
      recipeByPresentation: new Map([['p1', r]]),
      preparationsById: {},
    })
    expect(res.consumption).toEqual({ carne: 100 })
    expect(res.unmapped.map((u) => u.presentationId)).toEqual(['x'])
  })

  it('agrega units/revenue del mismo producto sin receta y ordena por revenue desc', () => {
    const res = computeConsumption({
      saleLines: [
        line({ presentationId: 'x', productName: 'Postre', qty: 1, lineRevenue: 5000 }),
        line({ presentationId: 'x', productName: 'Postre', qty: 2, lineRevenue: 10000 }),
        line({ presentationId: 'y', productName: 'Café', qty: 1, lineRevenue: 30000 }),
      ],
      recipeByPresentation: new Map(),
      preparationsById: {},
    })
    expect(res.unmapped).toEqual([
      { presentationId: 'y', productName: 'Café', units: 1, revenue: 30000 },
      { presentationId: 'x', productName: 'Postre', units: 3, revenue: 15000 },
    ])
  })

  it('ignora líneas con qty <= 0 o no finita', () => {
    const r = makeRecipe({
      posProductKey: { presentationId: 'p1', productGeneralId: 'g1', name: 'Burger' },
      components: [{ kind: 'item', refId: 'carne', qty: 100 }],
    })
    const res = computeConsumption({
      saleLines: [
        line({ presentationId: 'p1', qty: 0 }),
        line({ presentationId: 'p1', qty: -2 }),
        line({ presentationId: 'p1', qty: Number.NaN }),
      ],
      recipeByPresentation: new Map([['p1', r]]),
      preparationsById: {},
    })
    expect(res.consumption).toEqual({})
    expect(res.portionsByPresentation).toEqual({})
  })
})
