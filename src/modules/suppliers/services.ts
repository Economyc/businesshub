import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Supplier, SupplierFormData } from './types'

const COLLECTION = 'suppliers'

export const supplierService = {
  getAll: (companyId: string) => fetchCollection<Supplier>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Supplier>(companyId, COLLECTION, id),
  create: (companyId: string, data: SupplierFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<SupplierFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
