import { Timestamp } from 'firebase/firestore'

export interface Company {
  id: string
  name: string
  slug: string
  createdAt: Timestamp
}

export interface BaseEntity {
  id: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type Status = 'active' | 'inactive'
export type SupplierStatus = 'active' | 'expired' | 'pending'
export type TransactionType = 'income' | 'expense'
export type TransactionStatus = 'paid' | 'pending' | 'overdue'
