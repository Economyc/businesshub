import { fetchCollection, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { InventoryCategory, InventoryCategoryFormData } from '../types'

// Catálogo de categorías scoped por company (companies/{id}/inventoryCategories).
// NO es ROOT_COLLECTION: igual criterio que inventoryItems, el catálogo es propio
// de cada local.
const COLLECTION = 'inventoryCategories'

export const CATEGORIES_COLLECTION = COLLECTION

export const categoriesService = {
  getAll: (companyId: string) => fetchCollection<InventoryCategory>(companyId, COLLECTION),
  create: (companyId: string, data: InventoryCategoryFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<InventoryCategoryFormData>) =>
    updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
