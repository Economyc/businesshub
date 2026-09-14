import { cleanProductName, productKey, toDeliveryOrders } from './delivery-orders'
import type { PosVenta } from '@/modules/pos-sync/types'

type VentaInput = Partial<PosVenta> & { pagos?: string[] }

let seq = 0
function venta({ pagos = ['Efectivo'], ...rest }: VentaInput = {}): PosVenta {
  seq += 1
  return {
    ID: String(seq),
    serie: 'FVBT',
    correlativo: String(1000 + seq),
    fecha: '2026-08-07 19:42:10',
    id_local: 2,
    estado_txt: 'Comprobante emitido',
    canalventa: 'DELIVERY',
    id_canaldelivery: '516',
    nombre_canaldelivery: 'Rappi',
    subtotal: '80000',
    descuento: '0',
    total: '80000',
    costoenvio: '5000',
    detalle: [],
    pagosList: pagos.map((pagoventa_tipo) => ({ pagoventa_tipo })),
    cliente: null,
    ...rest,
  } as unknown as PosVenta
}

describe('toDeliveryOrders', () => {
  it('deja solo domicilios válidos de la sede', () => {
    const orders = toDeliveryOrders(
      [
        venta(),
        venta({ id_local: 1 }), // otra sede en el mismo caché
        venta({ id_local: '2' as unknown as number }), // id como string
        venta({ estado_txt: 'Comprobante anulado' }),
        venta({ canalventa: 'SALONES', id_canaldelivery: '', nombre_canaldelivery: '' }),
      ],
      [2],
    )
    expect(orders).toHaveLength(2)
    expect(orders.every((o) => o.channel === 'rappi')).toBe(true)
  })

  it('clasifica web, domicilio telefónico y DiDi', () => {
    const orders = toDeliveryOrders(
      [
        venta({ id_canaldelivery: '512', nombre_canaldelivery: 'Delivery Telefónico', pagos: ['En linea'] }),
        venta({ id_canaldelivery: '512', nombre_canaldelivery: 'Delivery Telefónico', pagos: ['Transferencia'] }),
        venta({ id_canaldelivery: '505', nombre_canaldelivery: 'Didi Food', pagos: ['En linea'] }),
      ],
      [2],
    )
    expect(orders.map((o) => o.channel).sort()).toEqual(['didi', 'domicilio', 'web'])
  })

  it('toma fecha y hora del texto del POS sin corrimiento de zona', () => {
    const [o] = toDeliveryOrders([venta({ fecha: '2026-08-31 23:58:00' })], [2])
    expect(o.date).toBe('2026-08-31')
    expect(o.time).toBe('23:58')
    expect(o.hour).toBe(23)
  })

  it('usa la venta neta sin envío y deduplica comprobantes repetidos', () => {
    const v = venta({ total: '72000', costoenvio: '6000' })
    const orders = toDeliveryOrders([v, { ...v }], [2])
    expect(orders).toHaveLength(1)
    expect(orders[0].sales).toBe(72000)
    expect(orders[0].shipping).toBe(6000)
  })

  it('toma el nombre del cliente como lo manda el POS', () => {
    const [o] = toDeliveryOrders(
      [venta({ cliente: { cliente: 'Cliente de Prueba', direccion: 'Carrera 10 #20-30, Medellín' } })],
      [2],
    )
    expect(o.customer).toBe('Cliente de Prueba')
  })

  it('normaliza el nombre de producto del detalle', () => {
    const [o] = toDeliveryOrders(
      [
        venta({
          detalle: [
            {
              nombre_producto: 'Red Smash  -',
              cantidad_vendida: '2.00',
              venta_total: '64000',
              categoria_descripcion: 'Hamburguesas',
            },
          ] as unknown as PosVenta['detalle'],
        }),
      ],
      [2],
    )
    expect(o.items[0]).toMatchObject({ product: 'Red Smash', units: 2, sales: 64000, category: 'Hamburguesas' })
  })
})

describe('nombres de producto', () => {
  it('quita sufijos y agrupa sin tildes ni mayúsculas', () => {
    expect(cleanProductName('Clasica Cheese Burguer -')).toBe('Clasica Cheese Burguer')
    expect(productKey(cleanProductName('Clásica  Cheese Burguer'))).toBe(productKey('clasica cheese burguer'))
  })
})
