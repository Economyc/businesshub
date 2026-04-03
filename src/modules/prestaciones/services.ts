import { orderBy, where } from 'firebase/firestore'
import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { SettlementRecord, SettlementFormData, SettlementType } from './types'

const COLLECTION = 'settlements'

export const settlementService = {
  getAll: (companyId: string) =>
    fetchCollection<SettlementRecord>(companyId, COLLECTION, orderBy('year', 'desc')),

  getById: (companyId: string, id: string) =>
    fetchDocument<SettlementRecord>(companyId, COLLECTION, id),

  create: (companyId: string, data: SettlementFormData) =>
    createDocument(companyId, COLLECTION, data),

  update: (companyId: string, id: string, data: Partial<SettlementFormData>) =>
    updateDocument(companyId, COLLECTION, id, data),

  remove: (companyId: string, id: string) =>
    removeDocument(companyId, COLLECTION, id),

  getByType: (companyId: string, type: SettlementType) =>
    fetchCollection<SettlementRecord>(companyId, COLLECTION, where('type', '==', type), orderBy('year', 'desc')),

  getByEmployee: async (companyId: string, employeeId: string) => {
    const all = await fetchCollection<SettlementRecord>(companyId, COLLECTION, orderBy('year', 'desc'))
    return all.filter((s) => s.items.some((i) => i.employeeId === employeeId))
  },
}
