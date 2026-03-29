import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity, TransactionType, TransactionStatus } from '@/core/types'

export interface Transaction extends BaseEntity {
  concept: string
  category: string
  amount: number
  type: TransactionType
  date: Timestamp
  status: TransactionStatus
  notes?: string
  sourceType?: 'closing' | 'purchase'
  sourceId?: string
  sourceLabel?: string
}

export type TransactionFormData = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

export interface BudgetItem {
  category: string
  type: TransactionType
  amount: number
}

export interface BudgetConfig {
  items: BudgetItem[]
}
