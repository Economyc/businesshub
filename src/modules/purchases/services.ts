import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import { syncPurchaseTransaction, deleteLinkedTransactions } from '@/core/services/transaction-sync'
import { notificationService } from '@/modules/notifications/services'
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
    try {
      await checkPriceIncreases(companyId, data)
    } catch (err) {
      console.error('[price-check] Error checking price increases:', err)
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

async function checkPriceIncreases(companyId: string, data: PurchaseFormData) {
  const previousPurchases = await fetchCollection<Purchase>(companyId, PURCHASES_COLLECTION)

  // Build map of last known price per product from previous purchases
  const lastPriceMap = new Map<string, { price: number; date: Date }>()
  for (const purchase of previousPurchases) {
    const d = purchase.date?.toDate?.()
    if (!d) continue
    for (const item of purchase.items) {
      const existing = lastPriceMap.get(item.productId)
      if (!existing || d > existing.date) {
        lastPriceMap.set(item.productId, { price: item.unitPrice, date: d })
      }
    }
  }

  // Check each item in the new purchase against last known price
  const increases: { name: string; prev: number; curr: number; pct: number }[] = []
  for (const item of data.items) {
    const last = lastPriceMap.get(item.productId)
    if (!last || last.price <= 0) continue
    if (item.unitPrice > last.price) {
      const pct = ((item.unitPrice - last.price) / last.price) * 100
      increases.push({ name: item.productName, prev: last.price, curr: item.unitPrice, pct })
    }
  }

  if (increases.length === 0) return

  const summaryParts = increases.map(
    (i) => `${i.name}: $${i.prev.toLocaleString('es-CO')} → $${i.curr.toLocaleString('es-CO')} (+${i.pct.toFixed(1)}%)`
  )

  await notificationService.create(companyId, {
    type: 'price-increase',
    title: increases.length === 1
      ? `${increases[0].name} subió de precio (+${increases[0].pct.toFixed(1)}%)`
      : `${increases.length} insumos subieron de precio`,
    summary: summaryParts.join(' | '),
    data: {
      supplierName: data.supplierName,
      increases: increases.map((i) => ({
        productName: i.name,
        previousPrice: i.prev,
        currentPrice: i.curr,
        changePercent: Math.round(i.pct * 10) / 10,
      })),
    },
    read: false,
  })
}
