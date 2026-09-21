// Puente de la utilidad causada a la caja que dejo el mes.
//
// Antes vivia dentro del render de Excel (informe-mensual-negocios.mjs L1090),
// lo que impedia calcularlo sin generar el archivo. Ahora es una funcion pura
// que recibe escalares, para que el navegador lo arme desde el snapshot.
//
// OJO: esto mide el FLUJO del mes, no el saldo disponible. La "Caja que dejo el
// mes" no es plata que este en la cuenta hoy.

import type { ManualItem } from './types.ts'

export interface BridgeRow {
  label: string
  valor: number
  tipo?: 'base' | 'total'
}

export interface BridgeInput {
  /** Rotulo del mes ("Agosto 2026"), para los textos de las filas. */
  monthLabel: string
  /** Utilidad neta causada del mes. */
  net: number
  /** Gasto de Ecore causado este mes y aun sin pagar. */
  soloCausadoEcore: number
  /** Gasto de Ecore pagado este mes que se causo en otro. */
  soloPagadoEcore: number
  /** Salidas de caja que el P&L excluye con razon (abonos a capital, interlocal). */
  fueraDelPnl: number
  impoAccrued: number
  impoPaid: number
  manualItems: ManualItem[]
  /** Plata facturada que el negocio todavia no puede usar. */
  incomeNotReceived: { concept: string; amount: number }[]
}

export interface Bridge {
  filas: BridgeRow[]
  caja: number
  /** Lo causado sin pagar: el costo de ponerse al dia, una sola vez. */
  porPagar: number
}

export function buildBridge(input: BridgeInput): Bridge {
  const {
    monthLabel, net, soloCausadoEcore, soloPagadoEcore, fueraDelPnl,
    impoAccrued, impoPaid, manualItems, incomeNotReceived,
  } = input

  // Un ajuste manual que devenga sin pagar suma al "aun no pagado"; uno que
  // paga sin devengar suma al "pagado de meses anteriores". Los que hacen las
  // dos cosas ya estan cuadrados y no mueven el puente.
  const soloCausado = soloCausadoEcore
    + manualItems.reduce((a, m) => a + (m.accrued && !m.paid ? m.accrued : 0), 0)
  const soloPagado = soloPagadoEcore
    + manualItems.reduce((a, m) => a + (m.paid && !m.accrued ? m.paid : 0), 0)

  const impoDif = impoPaid - impoAccrued

  const filas: BridgeRow[] = [
    { label: 'Utilidad neta del mes', valor: net, tipo: 'base' },
    { label: `Costos de ${monthLabel} que aún no se han pagado`, valor: soloCausado },
    { label: `Facturas de meses anteriores pagadas en ${monthLabel}`, valor: -soloPagado },
  ]

  // El impoconsumo se provisiona por mes y se gira por bimestres vencidos, asi
  // que casi nunca coinciden. El signo decide el rotulo: si se giro mas de lo
  // provisionado la caja sufrio, y si se provisiono sin girar, la caja todavia
  // tiene esa plata y le toca al bimestre siguiente.
  if (Math.abs(impoDif) > 0.5) {
    filas.push({
      label: impoDif > 0
        ? 'Giro a la DIAN (liquida el bimestre, no el mes)'
        : 'Impoconsumo provisionado que aún no se ha girado',
      valor: -impoDif,
    })
  }

  if (fueraDelPnl > 0.5) {
    filas.push({ label: 'Abonos a capital y movimientos que no son gasto', valor: -fueraDelPnl })
  }

  for (const i of incomeNotReceived) filas.push({ label: i.concept, valor: -i.amount })

  const caja = filas.reduce((a, f) => a + f.valor, 0)
  filas.push({ label: 'Caja que dejó el mes', valor: caja, tipo: 'total' })
  return { filas, caja, porPagar: soloCausado }
}
