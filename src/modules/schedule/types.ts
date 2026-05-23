import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

// Un turno concreto de un empleado en un día. Las fechas/horas se guardan como
// strings (`date` 'YYYY-MM-DD' + `start`/`end` 'HH:mm') para ser inmunes a
// timezone y poder consultar por `weekKey` sin range-queries (Firestore no
// permite rangos sobre dos campos). Un empleado puede tener 2+ shifts el mismo
// día (split shift). El estado borrador/publicado vive en `ScheduleWeek`, no en
// cada shift, para no duplicar ni multiplicar escrituras al publicar.
export interface Shift extends BaseEntity {
  weekKey: string // ISO week, ej. '2026-W21'
  date: string // 'YYYY-MM-DD'
  employeeId: string
  role?: string // override; por defecto el `role` del empleado
  start: string // 'HH:mm'
  end: string // 'HH:mm'
  breakMin?: number // minutos de descanso no pagado
  notes?: string
}

export type ShiftFormData = Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>

export type WeekStatus = 'draft' | 'published'

// Estado de una semana. Doc id = weekKey (determinístico, un doc por semana).
export interface ScheduleWeek {
  weekKey: string
  status: WeekStatus
  publishedAt?: Timestamp
  publishedBy?: string
}

// Plantilla de turno reutilizable ("Mañana 8-16"). El usuario la aplica al crear
// un turno (prefill) y luego ajusta a mano si hace falta — flujo "mixto".
export interface ShiftTemplate extends BaseEntity {
  name: string
  start: string // 'HH:mm'
  end: string // 'HH:mm'
  breakMin?: number
  color?: string
}

export type ShiftTemplateFormData = Omit<ShiftTemplate, 'id' | 'createdAt' | 'updatedAt'>
