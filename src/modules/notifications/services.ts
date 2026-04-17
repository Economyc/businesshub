import { orderBy } from 'firebase/firestore'
import {
  fetchCollection,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/core/firebase/helpers'
import type { AppNotification, NotificationFormData } from './types'

const COLLECTION = 'notifications'

export const notificationService = {
  getAll: (companyId: string) =>
    fetchCollection<AppNotification>(companyId, COLLECTION, orderBy('createdAt', 'desc')),

  create: (companyId: string, data: NotificationFormData) =>
    createDocument(companyId, COLLECTION, data),

  markAsRead: (companyId: string, id: string) =>
    updateDocument(companyId, COLLECTION, id, { read: true }),

  markAllAsRead: async (companyId: string) => {
    const all = await fetchCollection<AppNotification>(companyId, COLLECTION)
    const unread = all.filter((n) => !n.read)
    await Promise.all(
      unread.map((n) => updateDocument(companyId, COLLECTION, n.id, { read: true }))
    )
  },

  remove: (companyId: string, id: string) =>
    removeDocument(companyId, COLLECTION, id),

  removeAll: async (companyId: string) => {
    const all = await fetchCollection<AppNotification>(companyId, COLLECTION)
    await Promise.all(
      all.map((n) => removeDocument(companyId, COLLECTION, n.id))
    )
  },
}
