import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

export type PaymentTargetType = 'transaction' | 'purchase'

export interface Payment extends BaseEntity {
  targetType: PaymentTargetType
  targetId: string
  amount: number
  commission?: number
  date: Timestamp
  method?: string
  reference?: string
  notes?: string
}

export type PaymentFormData = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>

export interface CarteraItem {
  id: string
  type: 'receivable' | 'payable'
  sourceType: PaymentTargetType
  concept: string
  counterparty: string
  originalAmount: number
  paidAmount: number
  commissionAmount: number
  balance: number
  date: Timestamp
  dueDate?: Timestamp
  status: 'pending' | 'partial' | 'paid' | 'overdue'
  daysOutstanding: number
  payments: Payment[]
}

export interface CarteraSummary {
  totalReceivables: number
  totalPayables: number
  netPosition: number
  overdueTotal: number
}

export const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'datafono', label: 'Datáfono' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'otro', label: 'Otro' },
]
