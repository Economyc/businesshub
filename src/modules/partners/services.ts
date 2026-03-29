import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Partner, PartnerFormData } from './types'

const COLLECTION = 'partners'

export const partnerService = {
  getAll: (companyId: string) => fetchCollection<Partner>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Partner>(companyId, COLLECTION, id),
  create: (companyId: string, data: PartnerFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<PartnerFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
