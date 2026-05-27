import { CreditCard, Landmark, Banknote, ArrowLeftRight, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PaymentMethod, PaymentMethodType } from './types'

export const PAYMENT_METHOD_TYPE_ICON: Record<PaymentMethodType, LucideIcon> = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  savings_account: Landmark,
  checking_account: Landmark,
  cash: Banknote,
  transfer: ArrowLeftRight,
  other: Wallet,
}

export function getPaymentMethodIcon(method: Pick<PaymentMethod, 'type'>): LucideIcon {
  return PAYMENT_METHOD_TYPE_ICON[method.type]
}
