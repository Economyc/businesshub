// Reparto de gastos pagados por anticipado entre los meses que cubren.
//
// Unifica las dos copias que habia en informe-mensual-negocios.mjs:
// `deferredItems` (leia la tabla hardcodeada) y `spreadDeferrals` (recibia los
// detectados por `diferir N` en las notas). Eran el mismo algoritmo.

import { monthsBetween } from './month.ts'
import type { Deferral, ManualItem } from './types.ts'

const DEFAULT_SOURCE = 'Gasto pagado por anticipado'

/**
 * Convierte una lista de diferidos en los items que le tocan a `ym`.
 * Un diferido aporta cuota (`accrued`) en cada uno de sus `months` desde `from`,
 * y aporta el total en `paid` solo en el mes en que salio la plata.
 */
export function spreadDeferrals(list: Deferral[], ym: string, defaultSource = DEFAULT_SOURCE): ManualItem[] {
  const out: ManualItem[] = []
  for (const d of list) {
    if (!d.from || !d.months) continue
    const idx = monthsBetween(d.from, ym)
    const devenga = idx >= 0 && idx < d.months
    const accrued = devenga ? d.total / d.months : 0
    const paid = d.paidOn === ym ? d.total : 0
    if (!accrued && !paid) continue
    out.push({
      line: d.line,
      concept: devenga
        ? `${d.concept} — mes ${idx + 1} de ${d.months}`
        : `${d.concept} — pago anticipado (devenga desde ${d.from})`,
      accrued,
      paid,
      source: d.source ?? defaultSource,
    })
  }
  return out
}

/** Ids de transaccion ya cubiertos por un diferido: no deben cargarse dos veces. */
export const deferredTxIds = (list: Deferral[]): Set<string> =>
  new Set(list.map((d) => d.txId).filter((id): id is string => !!id))
