import { calcDocCounts, getDocType, getPaymentLabel } from './sales-calculations'
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

describe('getPaymentLabel', () => {
  const conPagos = (pagos: unknown[], tipo_pago = 'Contado'): PosVenta =>
    ({ tipo_pago, pagosList: pagos }) as PosVenta

  it('usa el nombre documentado de la API', () => {
    expect(getPaymentLabel(conPagos([{ pagoventa_tipo: 'Efectivo' }]))).toBe('Efectivo')
  })

  it('acepta el nombre alterno que a veces entrega el proxy', () => {
    expect(getPaymentLabel(conPagos([{ tipoPago: 'Transferencia' }]))).toBe('Transferencia')
  })

  it('detalla la tarjeta en vez de decir solo "Tarjeta"', () => {
    // Un comprobante de salón pagado con datáfono: "Tarjeta" a secas no informa.
    expect(
      getPaymentLabel(
        conPagos([{ pagoventa_tipo: 'Tarjeta', tarjeta: { tarjeta_descripcion: 'Datafono' } }]),
      ),
    ).toBe('Datafono')
  })

  it('marca Mixto cuando la venta se pagó con dos medios', () => {
    expect(
      getPaymentLabel(conPagos([{ pagoventa_tipo: 'Efectivo' }, { pagoventa_tipo: 'En linea' }])),
    ).toBe('Mixto')
  })

  it('no repite cuando los dos pagos son del mismo medio', () => {
    expect(
      getPaymentLabel(conPagos([{ pagoventa_tipo: 'Efectivo' }, { pagoventa_tipo: 'Efectivo' }])),
    ).toBe('Efectivo')
  })

  it('cae a tipo_pago cuando no hay pagosList', () => {
    // Único caso donde "Contado" es lo mejor que tenemos.
    expect(getPaymentLabel(conPagos([]))).toBe('Contado')
  })
})
