import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Transaction, TransactionFormData, BudgetConfig } from './types'

const COLLECTION = 'transactions'

export const financeService = {
  getAll: (companyId: string) => fetchCollection<Transaction>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Transaction>(companyId, COLLECTION, id),
  create: (companyId: string, data: TransactionFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<TransactionFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}

export const budgetService = {
  async get(companyId: string): Promise<BudgetConfig> {
    const ref = doc(db, 'companies', companyId, 'settings', 'budget')
    const snap = await getDoc(ref)
    if (snap.exists()) return snap.data() as BudgetConfig
    return { items: [] }
  },
  async save(companyId: string, config: BudgetConfig): Promise<void> {
    const ref = doc(db, 'companies', companyId, 'settings', 'budget')
    await setDoc(ref, config)
  },
}
