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
