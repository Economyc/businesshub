import { calcDocCounts, getDocType } from './sales-calculations'
import type { PosVenta } from '../types'

// Solo los campos que mira la clasificación; el resto de PosVenta no interviene.
const venta = (tipo_documento: string, documento: string): PosVenta =>
  ({ tipo_documento, documento }) as PosVenta

describe('getDocType', () => {
  it('clasifica factura por tipo_documento "F"', () => {
    expect(getDocType(venta('F', 'Factura'))).toBe('factura')
  })

  it('clasifica nota cuando tipo_documento viene VACÍO', () => {
    // Caso real de las 4 sedes: el POS no marca las notas de venta con "NV",
    // deja el campo en blanco. Sin el fallback por `documento` caerían en 'otro'
    // y en agosto 2026 eso serían 1.269 comprobantes mal clasificados.
    expect(getDocType(venta('', 'Nota de Venta'))).toBe('nota')
  })

  it('clasifica nota por tipo_documento "NV"', () => {
    expect(getDocType(venta('NV', 'Nota de Venta'))).toBe('nota')
  })

  it('clasifica boleta por tipo_documento "B"', () => {
    expect(getDocType(venta('B', 'Boleta'))).toBe('boleta')
  })

  it('cae en otro cuando no reconoce el tipo', () => {
    expect(getDocType(venta('X', 'Comprobante raro'))).toBe('otro')
  })

  it('no distingue mayúsculas', () => {
    expect(getDocType(venta('f', 'factura'))).toBe('factura')
    expect(getDocType(venta('', 'NOTA DE VENTA'))).toBe('nota')
  })
})

describe('calcDocCounts', () => {
  it('cuenta la mezcla real de facturas y notas', () => {
    // Proporción de Blue Manila en agosto 2026, a escala.
    const list = [
      ...Array(3).fill(venta('F', 'Factura')),
      ...Array(5).fill(venta('', 'Nota de Venta')),
    ]
    const c = calcDocCounts(list)
    expect(c).toEqual({ total: 8, factura: 3, boleta: 0, nota: 5, otro: 0 })
  })

  it('el total siempre es la suma de las partes', () => {
    const list = [
      venta('F', 'Factura'),
      venta('', 'Nota de Venta'),
      venta('B', 'Boleta'),
      venta('X', 'Otro'),
    ]
    const c = calcDocCounts(list)
    expect(c.factura + c.boleta + c.nota + c.otro).toBe(c.total)
    expect(c.total).toBe(4)
  })

  it('lista vacía → todo en cero (la UI divide por total)', () => {
    expect(calcDocCounts([])).toEqual({ total: 0, factura: 0, boleta: 0, nota: 0, otro: 0 })
  })
})
