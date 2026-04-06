import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity, SupplierStatus } from '@/core/types'

export interface Supplier extends BaseEntity {
  name: string
  identification: string
  category: string
  contactName: string
  email: string
  phone: string
  contractStart?: Timestamp
  contractEnd?: Timestamp
  status: SupplierStatus
  paymentTerms?: number    // 0=contado, 30, 60, 90 días
  creditLimit?: number     // Cupo de crédito máximo en COP
}

export type SupplierFormData = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>
