// Método de pago del catálogo por empresa. Lo que se guarda en cada transacción
// (Transaction.paymentMethod) y se vuelca al Sheet es el `name` — un string
// legible ("Nu Crédito", "Cuenta Bancolombia"). El resto de campos son metadata
// para identificarlo en la configuración.
export type PaymentMethodType =
  | 'credit_card'
  | 'debit_card'
  | 'savings_account'
  | 'checking_account'
  | 'cash'
  | 'transfer'
  | 'other'

export interface PaymentMethod {
  id: string
  name: string
  type: PaymentMethodType
  entity?: string
  last4?: string
}

// Etiquetas legibles por tipo. El icono se mapea en la UI (settings-payment-methods).
export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  credit_card: 'Tarjeta Crédito',
  debit_card: 'Tarjeta Débito',
  savings_account: 'Cuenta Ahorros',
  checking_account: 'Cuenta Corriente',
  cash: 'Efectivo',
  transfer: 'Transferencia',
  other: 'Otro',
}

export const PAYMENT_METHOD_TYPE_ORDER: PaymentMethodType[] = [
  'credit_card',
  'debit_card',
  'savings_account',
  'checking_account',
  'transfer',
  'cash',
  'other',
]
