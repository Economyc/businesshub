import { computeVariance } from './compute-variance'
import type { InventoryItem } from '../types'

/** Insumo mínimo para los tests (el dominio solo lee estos campos). */
function item(partial: Partial<InventoryItem> & { id: string }): InventoryItem {
  return {
    name: partial.id,
    category: '',
    stockUnit: 'g',
    purchaseUnit: 'kilogramos',
    purchaseToStockFactor: 1000,
    active: true,
    ...partial,
  } as InventoryItem
}

describe('computeVariance', () => {
  it('marca faltante cuando lo contado es menor que lo esperado', () => {
    const r = computeVariance({
      items: [item({ id: 'tomate', unitCost: 1000, purchaseToStockFactor: 1000 })], // $1/g
      countLines: [{ itemId: 'tomate', qty: 800 }],
      expectedStock: { tomate: 1000 },
    })
    expect(r.rows[0].kind).toBe('faltante')
    expect(r.rows[0].diff).toBe(-200)
    expect(r.rows[0].diffValue).toBeCloseTo(-200) // -200 g × $1/g
    expect(r.totals.shortageValue).toBeCloseTo(200)
    expect(r.totals.overageValue).toBe(0)
    expect(r.totals.netValue).toBeCloseTo(-200)
    expect(r.hasDifferences).toBe(true)
  })

  it('marca sobrante cuando lo contado supera lo esperado', () => {
    const r = computeVariance({
      items: [item({ id: 'queso', unitCost: 2000, purchaseToStockFactor: 1000 })], // $2/g
      countLines: [{ itemId: 'queso', qty: 1500 }],
      expectedStock: { queso: 1000 },
    })
    expect(r.rows[0].kind).toBe('sobrante')
    expect(r.rows[0].diff).toBe(500)
    expect(r.totals.overageValue).toBeCloseTo(1000) // 500 g × $2/g
    expect(r.totals.shortageValue).toBe(0)
    expect(r.totals.netValue).toBeCloseTo(1000)
  })

  it('diffValue es null cuando el insumo no tiene costo', () => {
    const r = computeVariance({
      items: [item({ id: 'sal', unitCost: undefined })],
      countLines: [{ itemId: 'sal', qty: 500 }],
      expectedStock: { sal: 800 },
    })
    expect(r.rows[0].diffValue).toBeNull()
    expect(r.rows[0].kind).toBe('faltante')
    // sin costo no suma a los totales en $, pero sí cuenta como insumo con diferencia
    expect(r.totals.shortageValue).toBe(0)
    expect(r.totals.itemsWithDiff).toBe(1)
    expect(r.hasDifferences).toBe(true)
  })

  it('un insumo activo no contado se reporta como faltante de todo su esperado', () => {
    const r = computeVariance({
      items: [item({ id: 'aceite', unitCost: 1000, purchaseToStockFactor: 1000 })],
      countLines: [],
      expectedStock: { aceite: 300 },
    })
    expect(r.rows[0].notCounted).toBe(true)
    expect(r.rows[0].counted).toBe(0)
    expect(r.rows[0].diff).toBe(-300)
    expect(r.rows[0].kind).toBe('faltante')
    expect(r.notCountedCount).toBe(1)
    expect(r.hasDifferences).toBe(true)
  })

  it('ignora ruido de punto flotante bajo el epsilon', () => {
    const r = computeVariance({
      items: [item({ id: 'harina' })],
      countLines: [{ itemId: 'harina', qty: 1000 }],
      expectedStock: { harina: 1000.0005 },
    })
    expect(r.rows[0].kind).toBe('igual')
    expect(r.hasDifferences).toBe(false)
    expect(r.totals.itemsWithDiff).toBe(0)
  })

  it('omite insumos inactivos', () => {
    const r = computeVariance({
      items: [item({ id: 'viejo', active: false, unitCost: 1000 })],
      countLines: [{ itemId: 'viejo', qty: 0 }],
      expectedStock: { viejo: 500 },
    })
    expect(r.rows).toHaveLength(0)
  })
})
