import type { BaseEntity } from '@/core/types'

export interface Closing extends BaseEntity {
  date: string
  ap: number
  qr: number
  datafono: number
  rappiVentas: number
  efectivo: number
  ventaTotal: number
  propinas: number
  gastos: number
  cajaMenor: number
  entregaEfectivo: number
  responsable: string
}

export type ClosingFormData = Omit<Closing, 'id' | 'createdAt' | 'updatedAt'>

export type DiscountType = 'partial' | 'full'
export type DiscountReason = 'Empleado' | 'Influencer' | 'Socio' | 'Prueba de calidad' | 'Otro'

export interface Discount extends BaseEntity {
  date: string
  type: DiscountType
  amount: number
  reason: DiscountReason
  description: string
  authorizedBy: string
}

export type DiscountFormData = Omit<Discount, 'id' | 'createdAt' | 'updatedAt'>
