import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { InventoryCount, InventoryCountFormData } from '../types'

// Conteos físicos scoped por company (companies/{id}/inventoryCounts). Cada conteo
// final ancla la proyección de stock (ver domain/compute-stock). NO es ROOT_COLLECTION.
const COLLECTION = 'inventoryCounts'

export const countsService = {
  getAll: (companyId: string) => fetchCollection<InventoryCount>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<InventoryCount>(companyId, COLLECTION, id),
  create: (companyId: string, data: InventoryCountFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<InventoryCountFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}

export const COUNTS_COLLECTION = COLLECTION
