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
  sourceType?: 'closing' | 'purchase' | 'recurring' | 'payroll'
  sourceId?: string
  sourceLabel?: string
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

/* ─── Conciliacion Bancaria ─── */

export type BankEntryType = 'credit' | 'debit'

export interface BankEntry {
  id: string
  date: string
  description: string
  amount: number
  type: BankEntryType
  reference?: string
  balance?: number
}

export interface ReconciliationMatch {
  bankEntryId: string
  transactionId: string
  confidence: number
  matchedBy: 'auto' | 'manual'
}

export type ReconciliationStatus = 'pending' | 'reconciled' | 'partial'

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  pending: 'Pendiente',
  reconciled: 'Conciliado',
  partial: 'Parcial',
}

export const RECONCILIATION_STATUS_COLORS: Record<ReconciliationStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  reconciled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-blue-50 text-blue-700 border-blue-200',
}

export interface BankStatement extends BaseEntity {
  fileName: string
  fileFormat: 'csv' | 'ofx'
  bankName?: string
  accountNumber?: string
  periodStart: string
  periodEnd: string
  entries: BankEntry[]
  matches: ReconciliationMatch[]
  status: ReconciliationStatus
  entryCount: number
  matchedCount: number
  unmatchedBankCount: number
  unmatchedTransactionCount: number
}

export type BankStatementFormData = Omit<BankStatement, 'id' | 'createdAt' | 'updatedAt'>
