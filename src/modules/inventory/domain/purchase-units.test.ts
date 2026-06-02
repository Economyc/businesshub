import { PURCHASE_UNITS, getPurchaseUnit, labelForPurchaseUnit, stockUnitLabel } from './purchase-units'

describe('PURCHASE_UNITS', () => {
  it('solo la caja es empaque con factor a preguntar (null)', () => {
    for (const u of PURCHASE_UNITS) {
      if (u.isPackaging) {
        expect(u.factor).toBeNull()
      } else {
        expect(u.factor).toBeGreaterThan(0)
      }
    }
    expect(PURCHASE_UNITS.filter((u) => u.isPackaging).map((u) => u.value)).toEqual(['caja'])
  })

  it('las métricas convierten a la unidad de stock correcta', () => {
    expect(getPurchaseUnit('kilogramos')).toMatchObject({ stockUnit: 'g', factor: 1000 })
    expect(getPurchaseUnit('libra')).toMatchObject({ stockUnit: 'g', factor: 500 })
    expect(getPurchaseUnit('litros')).toMatchObject({ stockUnit: 'ml', factor: 1000 })
    expect(getPurchaseUnit('gramos')).toMatchObject({ stockUnit: 'g', factor: 1 })
    expect(getPurchaseUnit('caja')).toMatchObject({ stockUnit: 'unidad', factor: null })
  })
})

describe('labelForPurchaseUnit', () => {
  it('devuelve el label del catálogo', () => {
    expect(labelForPurchaseUnit('kilogramos')).toBe('Kilogramos')
  })

  it('cae al valor crudo si no está en el catálogo (dato viejo)', () => {
    expect(labelForPurchaseUnit('bolsa 5kg')).toBe('bolsa 5kg')
  })
})

describe('stockUnitLabel', () => {
  it('traduce las unidades de stock', () => {
    expect(stockUnitLabel('g')).toBe('Gramos')
    expect(stockUnitLabel('ml')).toBe('Mililitros')
    expect(stockUnitLabel('unidad')).toBe('Unidades')
  })
})
