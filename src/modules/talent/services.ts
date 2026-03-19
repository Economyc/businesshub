import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Employee, EmployeeFormData } from './types'

const COLLECTION = 'employees'

export const talentService = {
  getAll: (companyId: string) => fetchCollection<Employee>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Employee>(companyId, COLLECTION, id),
  create: (companyId: string, data: EmployeeFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<EmployeeFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
