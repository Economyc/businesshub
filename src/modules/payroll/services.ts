import { orderBy, where } from 'firebase/firestore'
import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { PayrollRecord, PayrollFormData } from './types'

const COLLECTION = 'payrolls'

export const payrollService = {
  getAll: (companyId: string) =>
    fetchCollection<PayrollRecord>(companyId, COLLECTION, orderBy('year', 'desc'), orderBy('month', 'desc')),

  getById: (companyId: string, id: string) =>
    fetchDocument<PayrollRecord>(companyId, COLLECTION, id),

  create: (companyId: string, data: PayrollFormData) =>
    createDocument(companyId, COLLECTION, data),

  update: (companyId: string, id: string, data: Partial<PayrollFormData>) =>
    updateDocument(companyId, COLLECTION, id, data),

  remove: (companyId: string, id: string) =>
    removeDocument(companyId, COLLECTION, id),

  getByPeriod: (companyId: string, year: number, month: number) =>
    fetchCollection<PayrollRecord>(companyId, COLLECTION, where('year', '==', year), where('month', '==', month)),

  getByEmployee: async (companyId: string, employeeId: string) => {
    const all = await fetchCollection<PayrollRecord>(companyId, COLLECTION, orderBy('year', 'desc'), orderBy('month', 'desc'))
    return all.filter((p) => p.items.some((i) => i.employeeId === employeeId))
  },
}
