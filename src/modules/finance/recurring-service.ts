import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { RecurringTransaction, RecurringTransactionFormData } from './types'

const COLLECTION = 'recurring-transactions'

export const recurringService = {
  getAll: (companyId: string) => fetchCollection<RecurringTransaction>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<RecurringTransaction>(companyId, COLLECTION, id),
  create: (companyId: string, data: RecurringTransactionFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<RecurringTransactionFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
