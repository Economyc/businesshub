import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { InventoryReceipt, InventoryReceiptFormData } from '../types'

// Entradas / compras recibidas, scoped por company (companies/{id}/inventoryReceipts).
// Suben el stock proyectado (ver domain/compute-stock + aggregate-movements). La
// cantidad de cada línea va en UNIDAD DE COMPRA del insumo. NO es ROOT_COLLECTION.
const COLLECTION = 'inventoryReceipts'

export const receiptsService = {
  getAll: (companyId: string) => fetchCollection<InventoryReceipt>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<InventoryReceipt>(companyId, COLLECTION, id),
  create: (companyId: string, data: InventoryReceiptFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<InventoryReceiptFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}

export const RECEIPTS_COLLECTION = COLLECTION
