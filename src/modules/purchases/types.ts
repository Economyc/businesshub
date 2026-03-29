import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

export type PurchaseStatus = 'received' | 'partial' | 'pending'
export type PaymentStatus = 'paid' | 'pending' | 'overdue'

export interface Product extends BaseEntity {
  name: string
  category: string
  unit: string
  referencePrice: number
  reorderPoint?: number | null
  perishable: boolean
  active: boolean
}

export type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>

export interface PurchaseItem {
  productId: string
  productName: string
  quantity: number
  unit: string
  unitPrice: number
  subtotal: number
}

export interface Purchase extends BaseEntity {
  supplierId: string
  supplierName: string
  date: Timestamp
  invoiceNumber?: string
  items: PurchaseItem[]
  subtotal: number
  tax: number
  total: number
  status: PurchaseStatus
  paymentStatus: PaymentStatus
  paymentDueDate?: Timestamp
  notes?: string
}

export type PurchaseFormData = Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>

export const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'lb', label: 'Libras (lb)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'mL', label: 'Mililitros (mL)' },
  { value: 'und', label: 'Unidades (und)' },
  { value: 'caja', label: 'Cajas' },
  { value: 'paquete', label: 'Paquetes' },
]
