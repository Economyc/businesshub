import { Timestamp } from 'firebase/firestore'

export interface Company {
  id: string
  name: string
  slug: string
  location?: string
  color?: string
  logo?: string
  logoThumb?: string
  categories?: string[]
  posTenantId?: string
  driveRootFolderId?: string
  driveDiscountsFolderId?: string
  // Override manual del "dueño de Drive": uid cuyo token se usa para todas las
  // subidas de esta empresa. Si no está, se usa el primer miembro con rol owner.
  driveOwnerUid?: string
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
export type ContractStatus = 'draft' | 'active' | 'terminated' | 'expired'
export type ContractType = 'indefinido' | 'fijo' | 'obra_labor' | 'aprendizaje' | 'prestacion_servicios'
