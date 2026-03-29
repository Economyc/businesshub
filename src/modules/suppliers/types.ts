import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity, SupplierStatus } from '@/core/types'

export interface Supplier extends BaseEntity {
  name: string
  identification: string
  category: string
  contactName: string
  email: string
  phone: string
  contractStart: Timestamp
  contractEnd: Timestamp
  status: SupplierStatus
}

export type SupplierFormData = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>
