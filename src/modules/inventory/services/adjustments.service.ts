import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { InventoryAdjustment, InventoryAdjustmentFormData } from '../types'

// Ajustes / mermas, scoped por company (companies/{id}/inventoryAdjustments). Bajan el
// stock proyectado (qtyDelta en unidad de stock, positivo = sale). Ver compute-stock +
// aggregate-movements. NO es ROOT_COLLECTION.
const COLLECTION = 'inventoryAdjustments'

export const adjustmentsService = {
  getAll: (companyId: string) => fetchCollection<InventoryAdjustment>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<InventoryAdjustment>(companyId, COLLECTION, id),
  create: (companyId: string, data: InventoryAdjustmentFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<InventoryAdjustmentFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}

export const ADJUSTMENTS_COLLECTION = COLLECTION
