import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { InventoryItem, InventoryItemFormData } from '../types'

// Insumos scoped por company (companies/{id}/inventoryItems). NO es ROOT_COLLECTION:
// el stock es propio de cada local (ver plan §4).
const COLLECTION = 'inventoryItems'

export const itemsService = {
  getAll: (companyId: string) => fetchCollection<InventoryItem>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<InventoryItem>(companyId, COLLECTION, id),
  create: (companyId: string, data: InventoryItemFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<InventoryItemFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}

export const ITEMS_COLLECTION = COLLECTION
