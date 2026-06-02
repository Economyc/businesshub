import { computeStock } from './compute-stock'

describe('computeStock', () => {
  it('aplica anchor + entradas − ajustes − consumo', () => {
    const result = computeStock({
      anchor: { carne: 10000 },
      receipts: { carne: 5000 },
      adjustments: { carne: 500 },
      consumption: { carne: 3000 },
    })
    expect(result).toEqual({ carne: 11500 })
  })

  it('trata fuentes ausentes como 0 por insumo', () => {
    // un insumo que solo aparece en consumo arranca de anchor 0 → negativo posible
    const result = computeStock({ consumption: { papas: 200 } })
    expect(result).toEqual({ papas: -200 })
  })

  it('unifica el universo de insumos de todas las fuentes', () => {
    const result = computeStock({
      anchor: { a: 100 },
      receipts: { b: 50 },
      consumption: { c: 10 },
    })
    expect(result).toEqual({ a: 100, b: 50, c: -10 })
  })

  it('es idempotente: recomputar da el mismo resultado', () => {
    const input = {
      anchor: { x: 1000 },
      receipts: { x: 200 },
      adjustments: { x: 50 },
      consumption: { x: 300 },
    }
    expect(computeStock(input)).toEqual(computeStock(input))
  })

  it('devuelve objeto vacío sin entradas', () => {
    expect(computeStock({})).toEqual({})
  })
})
