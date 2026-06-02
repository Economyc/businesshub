import { costRecipe } from './cost-recipe'
import type { InventoryItem, Recipe, RecipeComponent } from '../types'

function makeRecipe(partial: Partial<Recipe> & { components: RecipeComponent[] }): Recipe {
  return { id: 'r', type: 'product', active: true, ...partial } as Recipe
}

function makeItem(partial: Partial<InventoryItem> & { id: string }): InventoryItem {
  return {
    name: partial.id,
    category: '',
    stockUnit: 'g',
    purchaseUnit: 'gramos',
    purchaseToStockFactor: 1,
    active: true,
    ...partial,
  } as InventoryItem
}

describe('costRecipe', () => {
  it('costea dos insumos con costo y queda completo', () => {
    const recipe = makeRecipe({
      components: [
        { kind: 'item', refId: 'pan', qty: 1 },
        { kind: 'item', refId: 'carne', qty: 150 },
      ],
    })
    const itemsById = {
      // pan: 1 unidad, costo por unidad = 800
      pan: makeItem({ id: 'pan', stockUnit: 'unidad', purchaseUnit: 'unidad', purchaseToStockFactor: 1, unitCost: 800 }),
      // carne: caja de 1000 g a $20.000 → 20 por g
      carne: makeItem({ id: 'carne', purchaseToStockFactor: 1000, unitCost: 20000 }),
    }
    const result = costRecipe({ recipe, itemsById, preparationsById: {} })
    // pan: 1 * 800 = 800; carne: 150 * 20 = 3000
    expect(result.totalCost).toBeCloseTo(3800, 6)
    expect(result.isComplete).toBe(true)
    expect(result.missingCostItemIds).toEqual([])
    // ordenadas desc por lineCost
    expect(result.lines.map((l) => l.itemId)).toEqual(['carne', 'pan'])
  })

  it('marca insumos sin unitCost como incompletos y no los suma', () => {
    const recipe = makeRecipe({
      components: [
        { kind: 'item', refId: 'pan', qty: 1 },
        { kind: 'item', refId: 'lechuga', qty: 30 },
      ],
    })
    const itemsById = {
      pan: makeItem({ id: 'pan', stockUnit: 'unidad', purchaseToStockFactor: 1, unitCost: 800 }),
      lechuga: makeItem({ id: 'lechuga' }), // sin unitCost
    }
    const result = costRecipe({ recipe, itemsById, preparationsById: {} })
    expect(result.totalCost).toBeCloseTo(800, 6)
    expect(result.isComplete).toBe(false)
    expect(result.missingCostItemIds).toEqual(['lechuga'])
    expect(result.lines.find((l) => l.itemId === 'lechuga')?.lineCost).toBe(0)
  })

  it('refleja el wasteFactor en la cantidad y el costo', () => {
    const recipe = makeRecipe({
      components: [{ kind: 'item', refId: 'lechuga', qty: 100, wasteFactor: 0.1 }],
    })
    const itemsById = { lechuga: makeItem({ id: 'lechuga', purchaseToStockFactor: 1, unitCost: 10 }) }
    const result = costRecipe({ recipe, itemsById, preparationsById: {} })
    // 110 g * 10 = 1100
    expect(result.totalCost).toBeCloseTo(1100, 6)
  })

  it('costea preparaciones anidadas escalando por yieldQty', () => {
    const salsa = makeRecipe({
      id: 'salsa',
      type: 'preparation',
      yieldQty: 10,
      components: [{ kind: 'item', refId: 'mayonesa', qty: 500 }],
    })
    const burger = makeRecipe({
      components: [
        { kind: 'item', refId: 'pan', qty: 1 },
        { kind: 'preparation', refId: 'salsa', qty: 2 },
      ],
    })
    const itemsById = {
      pan: makeItem({ id: 'pan', stockUnit: 'unidad', purchaseToStockFactor: 1, unitCost: 800 }),
      mayonesa: makeItem({ id: 'mayonesa', stockUnit: 'ml', purchaseToStockFactor: 1, unitCost: 5 }),
    }
    const result = costRecipe({ recipe: burger, itemsById, preparationsById: { salsa } })
    // salsa: 2/10 * 500 = 100 ml mayonesa * 5 = 500; pan 800 → 1300
    expect(result.totalCost).toBeCloseTo(1300, 6)
    expect(result.isComplete).toBe(true)
  })

  it('escala por porciones', () => {
    const recipe = makeRecipe({ components: [{ kind: 'item', refId: 'carne', qty: 150 }] })
    const itemsById = { carne: makeItem({ id: 'carne', purchaseToStockFactor: 1, unitCost: 20 }) }
    const result = costRecipe({ recipe, itemsById, preparationsById: {}, portions: 3 })
    // 150*3 = 450 g * 20 = 9000
    expect(result.totalCost).toBeCloseTo(9000, 6)
  })

  it('tolera insumos ausentes del catálogo (borrados)', () => {
    const recipe = makeRecipe({ components: [{ kind: 'item', refId: 'fantasma', qty: 5 }] })
    const result = costRecipe({ recipe, itemsById: {}, preparationsById: {} })
    expect(result.totalCost).toBe(0)
    expect(result.missingCostItemIds).toEqual(['fantasma'])
    expect(result.lines[0].name).toBe('fantasma')
  })

  it('calcula margen $ y % cuando hay salePrice', () => {
    const recipe = makeRecipe({ components: [{ kind: 'item', refId: 'carne', qty: 200 }] })
    const itemsById = { carne: makeItem({ id: 'carne', purchaseToStockFactor: 1, unitCost: 20 }) }
    // costo = 4000
    const result = costRecipe({ recipe, itemsById, preparationsById: {}, salePrice: 10000 })
    expect(result.margin).toBeCloseTo(6000, 6)
    expect(result.marginPct).toBeCloseTo(60, 6)
  })

  it('no calcula margen sin salePrice', () => {
    const recipe = makeRecipe({ components: [{ kind: 'item', refId: 'carne', qty: 200 }] })
    const itemsById = { carne: makeItem({ id: 'carne', purchaseToStockFactor: 1, unitCost: 20 }) }
    const result = costRecipe({ recipe, itemsById, preparationsById: {} })
    expect(result.margin).toBeUndefined()
    expect(result.marginPct).toBeUndefined()
  })

  it('no calcula margen con salePrice 0 (sin división por cero)', () => {
    const recipe = makeRecipe({ components: [{ kind: 'item', refId: 'carne', qty: 200 }] })
    const itemsById = { carne: makeItem({ id: 'carne', purchaseToStockFactor: 1, unitCost: 20 }) }
    const result = costRecipe({ recipe, itemsById, preparationsById: {}, salePrice: 0 })
    expect(result.margin).toBeUndefined()
    expect(result.marginPct).toBeUndefined()
  })

  it('receta sin componentes da costo 0 y completo', () => {
    const recipe = makeRecipe({ components: [] })
    const result = costRecipe({ recipe, itemsById: {}, preparationsById: {} })
    expect(result.totalCost).toBe(0)
    expect(result.lines).toEqual([])
    expect(result.isComplete).toBe(true)
  })
})
