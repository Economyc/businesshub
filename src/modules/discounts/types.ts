import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

export type DiscountType = 'partial' | 'full'
export type DiscountReason = 'Socio' | 'Bono' | 'Influencer' | 'Prueba' | 'Empleado'

export interface DiscountPhoto {
  driveFileId: string
  driveWebViewLink: string
  fileName: string
  mimeType: string
  uploadedAt: Timestamp
}

export interface Discount extends BaseEntity {
  date: string
  type: DiscountType
  amount: number
  reason: DiscountReason
  description: string
  authorizedBy: string
  photo?: DiscountPhoto
}

export type DiscountFormData = Omit<Discount, 'id' | 'createdAt' | 'updatedAt'>
