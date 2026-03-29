import type { BaseEntity } from '@/core/types'

export interface Partner extends BaseEntity {
  name: string
  identification: string
  email: string
  phone: string
  ownership: number
  investment: number
  status: 'active' | 'inactive'
}

export type PartnerFormData = Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>
