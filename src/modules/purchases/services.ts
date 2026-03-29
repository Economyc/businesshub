import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import { syncPurchaseTransaction, deleteLinkedTransactions } from '@/core/services/transaction-sync'
import type { Product, ProductFormData, Purchase, PurchaseFormData } from './types'

const PRODUCTS_COLLECTION = 'products'
const PURCHASES_COLLECTION = 'purchases'

export const productService = {
  getAll: (companyId: string) => fetchCollection<Product>(companyId, PRODUCTS_COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Product>(companyId, PRODUCTS_COLLECTION, id),
  create: (companyId: string, data: ProductFormData) => createDocument(companyId, PRODUCTS_COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<ProductFormData>) => updateDocument(companyId, PRODUCTS_COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, PRODUCTS_COLLECTION, id),
}

export const purchaseService = {
  getAll: (companyId: string) => fetchCollection<Purchase>(companyId, PURCHASES_COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Purchase>(companyId, PURCHASES_COLLECTION, id),

  create: async (companyId: string, data: PurchaseFormData) => {
    const id = await createDocument(companyId, PURCHASES_COLLECTION, data)
    try {
      await syncPurchaseTransaction(companyId, id, data)
    } catch (err) {
      console.error('[transaction-sync] Error syncing purchase transaction:', err)
    }
    return id
  },

  update: async (companyId: string, id: string, data: Partial<PurchaseFormData>) => {
    await updateDocument(companyId, PURCHASES_COLLECTION, id, data)
    try {
      const full = await fetchDocument<Purchase>(companyId, PURCHASES_COLLECTION, id)
      if (full) await syncPurchaseTransaction(companyId, id, full)
    } catch (err) {
      console.error('[transaction-sync] Error syncing purchase transaction:', err)
    }
  },

  remove: async (companyId: string, id: string) => {
    try {
      await deleteLinkedTransactions(companyId, 'purchase', id)
    } catch (err) {
      console.error('[transaction-sync] Error deleting linked transactions:', err)
    }
    await removeDocument(companyId, PURCHASES_COLLECTION, id)
  },
}
