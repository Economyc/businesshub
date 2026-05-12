import { fetchCollection, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Discount, DiscountFormData } from './types'

const COLLECTION = 'discounts'

export const discountService = {
  getAll: (companyId: string) => fetchCollection<Discount>(companyId, COLLECTION),

  create: (companyId: string, data: DiscountFormData) =>
    createDocument(companyId, COLLECTION, data),

  update: (companyId: string, id: string, data: Partial<DiscountFormData>) =>
    updateDocument(companyId, COLLECTION, id, data),

  remove: (companyId: string, id: string) =>
    removeDocument(companyId, COLLECTION, id),
}
