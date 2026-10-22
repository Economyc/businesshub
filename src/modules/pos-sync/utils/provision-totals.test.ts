// Guarda de sincronía: el cron de provisiones de Telegram
// (functions/src/utils/provision-totals.ts) porta a mano calcTotals/sumPropinas.
// Si alguien cambia uno sin el otro, este test lo delata.
import { calcProvisions } from '../../../../functions/src/utils/provision-totals'
import { calcTotals } from './sales-calculations'
import type { PosVenta } from '../types'

const ventas = [
  { tipo_documento: 'F', documento: 'Factura', total: '108000', impuestos: '8000', lista_propinas: [{ montoConIgv: '10800' }] },
  { tipo_documento: '', documento: 'Nota de Venta', total: '54000', impuestos: '4000', lista_propinas: [] },
  {
    tipo_documento: 'F',
    documento: 'Factura',
    total: '21600',
    impuestos: '1600',
    pagosList: [
      { pagoventa_tipo: 'Efectivo', pagoventa_monto: '21600' },
      { tipoPago: 'Propina', monto: '2000' },
    ],
  },
  { tipo_documento: 'B', documento: 'Boleta', total: '10000', impuestos: '0' },
] as unknown as PosVenta[]

describe('calcProvisions (functions) ≡ calcTotals (app)', () => {
  it('da las mismas propinas, impoconsumo y autorretención', () => {
    const app = calcTotals(ventas)
    const cron = calcProvisions(ventas)
    expect(cron.propinas).toBe(app.propinas)
    expect(cron.impoconsumo).toBe(app.impuestos)
    expect(cron.retefuente).toBeCloseTo(app.autorretencion)
    expect(cron.propinas).toBe(12_800)
    expect(cron.retefuente).toBeCloseTo(4_200)
  })

  it('ignora los comprobantes anulados', () => {
    const anulada = { ...ventas[0], estado_txt: 'Comprobante anulado' } as PosVenta
    expect(calcProvisions([anulada]).count).toBe(0)
    expect(calcProvisions([anulada]).impoconsumo).toBe(0)
  })
})
