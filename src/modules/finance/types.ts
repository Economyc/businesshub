import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity, TransactionType, TransactionStatus } from '@/core/types'

export type PayeeType = 'partner' | 'employee' | 'supplier' | 'external'

// A quien le debemos esta transaccion. Se puebla cuando alguien (un socio, un
// empleado, un proveedor a credito o un tercero) adelanta la plata o nos vende
// a credito y quedamos con la deuda. Cartera lee payeeRef.name como
// counterparty cuando existe.
export interface PayeeRef {
  type: PayeeType
  id: string
  name: string
}

export interface Transaction extends BaseEntity {
  concept: string
  category: string
  amount: number
  type: TransactionType
  date: Timestamp
  status: TransactionStatus
  notes?: string
  sourceType?: 'closing' | 'recurring'
  sourceId?: string
  sourceLabel?: string
  payeeRef?: PayeeRef
  splitGroupId?: string
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringTransaction extends BaseEntity {
  concept: string
  category: string
  amount: number
  type: TransactionType
  status: TransactionStatus
  notes?: string
  frequency: RecurrenceFrequency
  startDate: Timestamp
  endDate?: Timestamp
  nextDueDate: Timestamp
  lastGeneratedDate?: Timestamp
  isActive: boolean
}

export type RecurringTransactionFormData = Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>

export type TransactionFormData = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

export interface BudgetItem {
  category: string
  type: TransactionType
  amount: number
}

export interface BudgetConfig {
  items: BudgetItem[]
}
