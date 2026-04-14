import type { BaseEntity } from '@/core/types'

export type NotificationType = 'weekly-report' | 'overdue-alert' | 'closing-reminder' | 'price-increase'

export interface AppNotification extends BaseEntity {
  type: NotificationType
  title: string
  summary: string
  data?: Record<string, unknown>
  read: boolean
}

export type NotificationFormData = Omit<AppNotification, 'id' | 'createdAt' | 'updatedAt'>
