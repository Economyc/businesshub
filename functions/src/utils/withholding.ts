// Retención en la fuente practicada al proveedor (Ecore, cuentas por pagar).
//
// Port server-side de `Ecore/src/modules/invoicing/utils/amounts.ts`. Los dos
// repos comparten la colección `transactions` pero no el código, así que si
// cambia la regla allá hay que cambiarla acá (mismo trato que accounting-rows).
//
//   amount     → lo CAUSADO. El gasto del P&L. La retención no lo toca.
//   payableOf  → lo que se GIRA = amount − withholdingAmount. La retención no
//                se le paga al proveedor sino a la DIAN.
//
// Invariante: paidAmount + withholdingAmount + remainingAmount === amount
//
// Sin retención `payableOf === amount`, así que todo lo viejo se comporta igual.

export interface WithholdingLike {
  amount?: number
  paidAmount?: number
  withholdingAmount?: number
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Retención practicada sobre la factura (0 si no tiene). */
export function withheldOf(t: WithholdingLike): number {
  return Math.max(0, num(t.withholdingAmount))
}

/** Lo que hay que girarle al proveedor: el bruto menos la retención. */
export function payableOf(t: WithholdingLike): number {
  return Math.max(0, num(t.amount) - withheldOf(t))
}

// Estado derivado, contra el NETO: girado el neto la factura queda saldada
// aunque `paidAmount < amount` por la retención. El orden importa —
// `paid >= payable` va primero para cubrir payable === 0.
export function statusForPayable(payable: number, paid: number): 'pending' | 'partial' | 'paid' {
  if (paid >= payable) return 'paid'
  if (paid <= 0) return 'pending'
  return 'partial'
}

/**
 * Lo que falta girarle al tercero: el neto menos lo ya abonado. Prefiere el
 * denormalizado `remainingAmount` que mantiene Ecore, con fallback calculado
 * para transacciones viejas que no lo tienen.
 */
export function pendingOf(
  t: WithholdingLike & { remainingAmount?: number },
): number {
  if (typeof t.remainingAmount === 'number' && Number.isFinite(t.remainingAmount)) {
    return Math.max(0, t.remainingAmount)
  }
  return Math.max(0, payableOf(t) - Math.max(0, num(t.paidAmount)))
}
