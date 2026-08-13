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
  // Override explícito del local POS de esta sede. Necesario cuando el nombre
  // del local en el POS no coincide con `location` (ej. San Lucas ↔ "FILIPO
  // POBLADO"). Si está seteado, gana sobre el matching heurístico por nombre.
  posLocalId?: number
  driveRootFolderId?: string
  driveDiscountsFolderId?: string
  // Override manual del "dueño de Drive": uid cuyo token se usa para todas las
  // subidas de esta empresa. Si no está, se usa el primer miembro con rol owner.
  driveOwnerUid?: string
  // Plazo de pago por defecto en días. Pre-llena dueDate = fecha emisión + N al
  // crear facturas a crédito. Configurable por empresa en Ajustes. undefined =>
  // sin pre-llenado (el usuario pone la fecha límite a mano si quiere).
  defaultPaymentTermDays?: number
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
