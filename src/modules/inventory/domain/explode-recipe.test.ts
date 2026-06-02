import { explodeRecipe } from './explode-recipe'
import type { Recipe, RecipeComponent } from '../types'

// Factory mínimo: las funciones puras solo leen components/yieldQty/type,
// así que casteamos sin construir Timestamps reales.
function makeRecipe(partial: Partial<Recipe> & { components: RecipeComponent[] }): Recipe {
  return { id: 'r', type: 'product', active: true, ...partial } as Recipe
}

describe('explodeRecipe', () => {
  it('suma insumos directos por porción', () => {
    const recipe = makeRecipe({
      components: [
        { kind: 'item', refId: 'pan', qty: 1 },
        { kind: 'item', refId: 'carne', qty: 150 },
      ],
    })
    expect(explodeRecipe({ recipe, preparationsById: {} })).toEqual({ pan: 1, carne: 150 })
  })

  it('multiplica por las porciones vendidas', () => {
    const recipe = makeRecipe({ components: [{ kind: 'item', refId: 'carne', qty: 150 }] })
    expect(explodeRecipe({ recipe, preparationsById: {}, portions: 3 })).toEqual({ carne: 450 })
  })

  it('aplica wasteFactor', () => {
    const recipe = makeRecipe({ components: [{ kind: 'item', refId: 'lechuga', qty: 100, wasteFactor: 0.1 }] })
    const result = explodeRecipe({ recipe, preparationsById: {} })
    expect(Object.keys(result)).toEqual(['lechuga'])
    expect(result.lechuga).toBeCloseTo(110, 6)
  })

  it('explota preparaciones anidadas escalando por yieldQty', () => {
    // La salsa rinde 10 porciones con 500 ml de mayonesa + 100 g de tomate.
    const salsa = makeRecipe({
      id: 'salsa',
      type: 'preparation',
      yieldQty: 10,
      components: [
        { kind: 'item', refId: 'mayonesa', qty: 500 },
        { kind: 'item', refId: 'tomate', qty: 100 },
      ],
    })
    // La hamburguesa usa 2 porciones de salsa + 1 pan.
    const burger = makeRecipe({
      components: [
        { kind: 'item', refId: 'pan', qty: 1 },
        { kind: 'preparation', refId: 'salsa', qty: 2 },
      ],
    })
    // 2 porciones de salsa = 2/10 de la receta → 100 ml mayonesa + 20 g tomate.
    expect(explodeRecipe({ recipe: burger, preparationsById: { salsa } })).toEqual({
      pan: 1,
      mayonesa: 100,
      tomate: 20,
    })
  })

  it('agrega el mismo insumo usado en varios componentes', () => {
    const salsa = makeRecipe({
      id: 'salsa',
      type: 'preparation',
      yieldQty: 1,
      components: [{ kind: 'item', refId: 'sal', qty: 5 }],
    })
    const recipe = makeRecipe({
      components: [
        { kind: 'item', refId: 'sal', qty: 2 },
        { kind: 'preparation', refId: 'salsa', qty: 1 },
      ],
    })
    expect(explodeRecipe({ recipe, preparationsById: { salsa } })).toEqual({ sal: 7 })
  })

  it('ignora preparaciones sin receta definida (no rompe)', () => {
    const recipe = makeRecipe({
      components: [
        { kind: 'item', refId: 'pan', qty: 1 },
        { kind: 'preparation', refId: 'desconocida', qty: 1 },
      ],
    })
    expect(explodeRecipe({ recipe, preparationsById: {} })).toEqual({ pan: 1 })
  })

  it('corta ciclos entre preparaciones', () => {
    const a = makeRecipe({
      id: 'a',
      type: 'preparation',
      yieldQty: 1,
      components: [
        { kind: 'item', refId: 'x', qty: 1 },
        { kind: 'preparation', refId: 'b', qty: 1 },
      ],
    })
    const b = makeRecipe({
      id: 'b',
      type: 'preparation',
      yieldQty: 1,
      components: [
        { kind: 'item', refId: 'y', qty: 1 },
        { kind: 'preparation', refId: 'a', qty: 1 }, // ciclo a→b→a
      ],
    })
    const root = makeRecipe({ components: [{ kind: 'preparation', refId: 'a', qty: 1 }] })
    // No debe colgarse; consume x e y una vez antes de cortar el ciclo.
    expect(explodeRecipe({ recipe: root, preparationsById: { a, b } })).toEqual({ x: 1, y: 1 })
  })
})
