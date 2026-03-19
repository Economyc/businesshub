import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Transaction, TransactionFormData } from './types'

const COLLECTION = 'transactions'

export const financeService = {
  getAll: (companyId: string) => fetchCollection<Transaction>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Transaction>(companyId, COLLECTION, id),
  create: (companyId: string, data: TransactionFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<TransactionFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
