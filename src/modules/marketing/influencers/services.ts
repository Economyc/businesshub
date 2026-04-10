import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { InfluencerVisit, InfluencerVisitFormData } from './types'

const COLLECTION = 'influencer-visits'

export const influencerService = {
  getAll: (companyId: string) => fetchCollection<InfluencerVisit>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<InfluencerVisit>(companyId, COLLECTION, id),
  create: (companyId: string, data: InfluencerVisitFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<InfluencerVisitFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
