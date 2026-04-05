import { orderBy } from 'firebase/firestore'
import { fetchCollection, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Conversation } from './types'
import type { Message } from '@ai-sdk/ui-utils'

const COLLECTION = 'conversations'

export const conversationService = {
  getAll: (companyId: string) =>
    fetchCollection<Conversation>(companyId, COLLECTION, orderBy('updatedAt', 'desc')),

  create: (companyId: string, data: { title: string; messages: Message[]; messageCount: number }) =>
    createDocument(companyId, COLLECTION, data),

  update: (companyId: string, id: string, data: { messages: Message[]; messageCount: number; title?: string }) =>
    updateDocument(companyId, COLLECTION, id, data),

  remove: (companyId: string, id: string) =>
    removeDocument(companyId, COLLECTION, id),
}
