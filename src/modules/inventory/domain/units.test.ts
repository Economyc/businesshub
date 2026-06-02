import { toStock, toPurchase, purchaseUnitsToCover, costPerStockUnit } from './units'

describe('toStock', () => {
  it('multiplica compra por factor', () => {
    expect(toStock(2, 5000)).toBe(10000)
  })

  it('devuelve 0 para cantidad 0', () => {
    expect(toStock(0, 5000)).toBe(0)
  })
})

describe('toPurchase', () => {
  it('divide stock por factor', () => {
    expect(toPurchase(10000, 5000)).toBe(2)
  })

  it('devuelve 0 si el factor es 0 o negativo (sin dividir por cero)', () => {
    expect(toPurchase(10000, 0)).toBe(0)
    expect(toPurchase(10000, -1)).toBe(0)
  })
})

describe('ida y vuelta', () => {
  it('toPurchase(toStock(x)) === x', () => {
    const factor = 750
    expect(toPurchase(toStock(3, factor), factor)).toBe(3)
  })
})

describe('purchaseUnitsToCover', () => {
  it('redondea hacia arriba a unidad de compra entera', () => {
    // necesito 12000 g, una caja rinde 5000 g → 3 cajas
    expect(purchaseUnitsToCover(12000, 5000)).toBe(3)
  })

  it('exacto no redondea de más', () => {
    expect(purchaseUnitsToCover(10000, 5000)).toBe(2)
  })

  it('devuelve 0 para objetivos no positivos o factor inválido', () => {
    expect(purchaseUnitsToCover(0, 5000)).toBe(0)
    expect(purchaseUnitsToCover(-5, 5000)).toBe(0)
    expect(purchaseUnitsToCover(100, 0)).toBe(0)
  })
})

describe('costPerStockUnit', () => {
  it('calcula el costo por lata de una caja', () => {
    // caja de 12 latas a $24.000 → $2.000 por lata
    expect(costPerStockUnit(24000, 12)).toBe(2000)
  })

  it('calcula el costo por gramo de un kilo', () => {
    expect(costPerStockUnit(20000, 1000)).toBe(20)
  })

  it('devuelve 0 si no hay costo o el factor es inválido', () => {
    expect(costPerStockUnit(0, 12)).toBe(0)
    expect(costPerStockUnit(24000, 0)).toBe(0)
    expect(costPerStockUnit(24000, -1)).toBe(0)
  })
})
