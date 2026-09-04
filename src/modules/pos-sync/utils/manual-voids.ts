// Comprobantes que el POS dejó como "Comprobante activo" pero que en su propio
// panel figuran anulados: con nota crédito emitida y/o el pedido de delivery
// cancelado. La API de integración NO expone ninguno de esos dos estados
// —verificado el 2026-09-03: el comprobante llega con `estado_txt` activo,
// `venta_observaciones` en null, ninguna de sus 44 claves menciona la nota
// crédito, y 30 endpoints candidatos (notas crédito y pedidos de delivery)
// responden 404—, así que la anulación se aplica acá a mano.
//
// Se marcan como anulados en vez de borrarlos porque toda la app ya sabe
// ignorar `estado_txt === 'comprobante anulado'`: salen de Ventas, aparecen en
// la pestaña Anuladas y dejan de sumar en KPIs, canales, Home, informes y
// conciliación bancaria, sin tocar a ningún consumidor.
//
// Se aplica AL ESCRIBIR el caché, así que sobrevive a un rebuild del mes.
// ESPEJO en `functions/src/pos-cache.ts` (MANUAL_VOIDS): si cambia una lista,
// cambiar la otra o el cron y el cliente se pisarán.
//
// Si el POS empieza a anular estos comprobantes de su lado, la entrada deja de
// tener efecto y se puede borrar.

export interface ManualVoid {
  localId: number
  serie: string
  correlativo: string
  reason: string
}

export const MANUAL_VOIDS: ManualVoid[] = [
  {
    localId: 2,
    serie: 'FVBT',
    correlativo: '1797',
    reason: 'Nota de crédito F000-00000008 del 18/08/2026 · motivo "pruebas sistema" · pedido C2-3747 cancelado',
  },
]

interface VoidableVenta {
  id_local?: number | string
  serie?: string
  correlativo?: string
  [key: string]: unknown
}

function matches(v: VoidableVenta, mv: ManualVoid): boolean {
  return (
    Number(v.id_local) === mv.localId &&
    String(v.serie ?? '').trim() === mv.serie &&
    String(v.correlativo ?? '').trim() === mv.correlativo
  )
}

// Devuelve la venta anulada si está en la lista; si no, la misma referencia.
export function applyManualVoid<T extends VoidableVenta>(v: T): T {
  const mv = MANUAL_VOIDS.find((m) => matches(v, m))
  if (!mv) return v
  return {
    ...v,
    estado: '0',
    estado_txt: 'Comprobante anulado',
    hubVoidReason: mv.reason,
  }
}
