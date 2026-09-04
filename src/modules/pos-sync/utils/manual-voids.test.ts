import { applyManualVoid, MANUAL_VOIDS } from './manual-voids'
import { isAnulada } from './sales-calculations'
import type { PosVenta } from '../types'

const venta = (id_local: number, serie: string, correlativo: string): PosVenta =>
  ({ id_local, serie, correlativo, estado: '1', estado_txt: 'Comprobante activo', total: '4635600.00' }) as PosVenta

describe('applyManualVoid', () => {
  it('anula el comprobante que el POS dejó activo pese a la nota crédito', () => {
    // FVBT-1797: el panel del POS muestra nota crédito F000-00000008 y el pedido
    // C2-3747 cancelado, pero la API lo entrega como "Comprobante activo".
    const out = applyManualVoid(venta(2, 'FVBT', '1797'))
    expect(out.estado).toBe('0')
    expect(out.estado_txt).toBe('Comprobante anulado')
    expect(out.hubVoidReason).toContain('F000-00000008')
  })

  it('deja el resto de comprobantes intactos', () => {
    const v = venta(2, 'FVBT', '1798')
    expect(applyManualVoid(v)).toBe(v)
  })

  it('no confunde el mismo correlativo en otro local', () => {
    const v = venta(1, 'FVBT', '1797')
    expect(applyManualVoid(v)).toBe(v)
  })

  it('el resultado lo reconoce el filtro de anuladas que usa toda la app', () => {
    // Es lo que hace que salga de Ventas, aparezca en Anuladas y deje de sumar.
    expect(isAnulada(applyManualVoid(venta(2, 'FVBT', '1797')) as PosVenta)).toBe(true)
  })

  it('cada entrada de la lista declara su motivo', () => {
    for (const mv of MANUAL_VOIDS) expect(mv.reason.trim().length).toBeGreaterThan(10)
  })
})
