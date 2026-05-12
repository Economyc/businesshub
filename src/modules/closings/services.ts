import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import { syncClosingTransactions, deleteLinkedTransactions } from '@/core/services/transaction-sync'
import type { Closing, ClosingFormData } from './types'

const COLLECTION = 'closings'

export const closingService = {
  getAll: (companyId: string) => fetchCollection<Closing>(companyId, COLLECTION),

  create: async (companyId: string, data: ClosingFormData) => {
    const id = await createDocument(companyId, COLLECTION, data)
    try {
      await syncClosingTransactions(companyId, id, data)
    } catch (err) {
      console.error('[transaction-sync] Error syncing closing transactions:', err)
    }
    return id
  },

  update: async (companyId: string, id: string, data: Partial<ClosingFormData>) => {
    await updateDocument(companyId, COLLECTION, id, data)
    try {
      const full = await fetchDocument<Closing>(companyId, COLLECTION, id)
      if (full) await syncClosingTransactions(companyId, id, full)
    } catch (err) {
      console.error('[transaction-sync] Error syncing closing transactions:', err)
    }
  },

  remove: async (companyId: string, id: string) => {
    try {
      await deleteLinkedTransactions(companyId, 'closing', id)
    } catch (err) {
      console.error('[transaction-sync] Error deleting linked transactions:', err)
    }
    await removeDocument(companyId, COLLECTION, id)
  },
}
