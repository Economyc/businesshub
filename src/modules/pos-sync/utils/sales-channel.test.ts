import { calcChannelBreakdown, getChannelLabel, getSalesChannel } from './sales-channel'
import type { PosPago, PosVenta } from '../types'

// Solo los campos que mira la clasificación. Los valores salen de comprobantes
// reales de Blue Escondite y Filipo Belén de 2026.
const venta = (
  canalventa: string,
  id_canaldelivery: string | null,
  nombre_canaldelivery: string | null,
  pagos: string[] = [],
): PosVenta =>
  ({
    canalventa,
    id_canaldelivery,
    nombre_canaldelivery,
    pagosList: pagos.map((pagoventa_tipo) => ({ pagoventa_tipo })) as PosPago[],
  }) as unknown as PosVenta

describe('getSalesChannel', () => {
  it('clasifica salón cuando no hay canal de delivery', () => {
    expect(getSalesChannel(venta('SALONES', '', ''))).toBe('salon')
  })

  it('clasifica Rappi por id 516', () => {
    expect(getSalesChannel(venta('DELIVERY', '516', 'Rappi', ['En linea']))).toBe('rappi')
  })

  it('clasifica DiDi por id 505', () => {
    // Antes caía en "DELIVERY": `canalventa` ganaba el || y el nombre del canal
    // nunca se alcanzaba.
    expect(getSalesChannel(venta('DELIVERY', '505', 'Didi Food', ['En linea']))).toBe('didi')
  })

  it('clasifica domicilio propio por id 512', () => {
    expect(getSalesChannel(venta('DELIVERY', '512', 'Delivery Telefónico', ['Transferencia']))).toBe(
      'domicilio',
    )
  })

  it('separa la web del domicilio propio por el pago "En linea"', () => {
    expect(getSalesChannel(venta('DELIVERY', '512', 'Delivery Telefónico', ['En linea']))).toBe('web')
  })

  it('la plataforma gana sobre la heurística de web', () => {
    // Rappi y DiDi también liquidan "En linea"; no deben volverse web.
    expect(getSalesChannel(venta('DELIVERY', '516', 'Rappi', ['En linea']))).toBe('rappi')
    expect(getSalesChannel(venta('DELIVERY', '505', 'Didi Food', ['En linea']))).toBe('didi')
  })

  it('trata el delivery sin canal como domicilio propio', () => {
    // Caso real: un comprobante de agosto con id_canaldelivery en null.
    expect(getSalesChannel(venta('DELIVERY', null, '', ['Efectivo']))).toBe('domicilio')
  })

  it('reconoce la plataforma por nombre si el id es desconocido', () => {
    expect(getSalesChannel(venta('DELIVERY', '999', 'DiDi Express'))).toBe('didi')
    expect(getSalesChannel(venta('DELIVERY', '999', 'Rappi Turbo'))).toBe('rappi')
  })

  it('cae en otro cuando el POS manda un canalventa desconocido', () => {
    expect(getSalesChannel(venta('MOSTRADOR', '', ''))).toBe('otro')
  })
})

describe('getChannelLabel', () => {
  it('normaliza las etiquetas conocidas', () => {
    expect(getChannelLabel(venta('SALONES', '', ''))).toBe('SALÓN')
    expect(getChannelLabel(venta('DELIVERY', '512', 'Delivery Telefónico'))).toBe('DOMICILIO')
    expect(getChannelLabel(venta('DELIVERY', '512', 'Delivery Telefónico', ['En linea']))).toBe('WEB')
    expect(getChannelLabel(venta('DELIVERY', '516', 'Rappi'))).toBe('RAPPI')
    expect(getChannelLabel(venta('DELIVERY', '505', 'Didi Food'))).toBe('DIDI')
  })

  it('muestra el texto crudo de un canal que no conoce', () => {
    // Una plataforma nueva tiene que verse, no desaparecer tras una etiqueta genérica.
    expect(getChannelLabel(venta('MOSTRADOR', '', ''))).toBe('MOSTRADOR')
  })
})

describe('calcChannelBreakdown', () => {
  const conTotal = (v: PosVenta, total: string, estado_txt = 'Comprobante activo'): PosVenta =>
    ({ ...v, total, estado_txt }) as PosVenta

  it('agrupa por canal, ordena por monto y reparte 100%', () => {
    const list = [
      conTotal(venta('SALONES', '', ''), '100000'),
      conTotal(venta('SALONES', '', ''), '100000'),
      conTotal(venta('DELIVERY', '516', 'Rappi', ['En linea']), '50000'),
      conTotal(venta('DELIVERY', '505', 'Didi Food', ['En linea']), '30000'),
      conTotal(venta('DELIVERY', '512', 'Delivery Telefónico', ['En linea']), '20000'),
    ]
    const out = calcChannelBreakdown(list)
    expect(out.map((c) => c.channel)).toEqual(['salon', 'rappi', 'didi', 'web'])
    expect(out[0]).toMatchObject({ count: 2, monto: 200000 })
    expect(out[0].pct).toBeCloseTo(66.7, 1)
    expect(out.reduce((s, c) => s + c.pct, 0)).toBeCloseTo(100)
  })

  it('excluye comprobantes anulados', () => {
    const list = [
      conTotal(venta('SALONES', '', ''), '100000'),
      conTotal(venta('DELIVERY', '505', 'Didi Food'), '999999', 'Comprobante anulado'),
    ]
    const out = calcChannelBreakdown(list)
    expect(out).toHaveLength(1)
    expect(out[0].channel).toBe('salon')
  })

  it('no divide por cero cuando no hay ventas', () => {
    expect(calcChannelBreakdown([])).toEqual([])
  })
})
