import { fetchCollection } from '@/core/firebase/helpers'
import { syncClosingTransactions, syncPurchaseTransaction } from './transaction-sync'
import type { Closing } from '@/modules/closings/types'
import type { Purchase } from '@/modules/purchases/types'

export async function migrateExistingData(companyId: string): Promise<{ closings: number; purchases: number }> {
  const [closings, purchases] = await Promise.all([
    fetchCollection<Closing>(companyId, 'closings'),
    fetchCollection<Purchase>(companyId, 'purchases'),
  ])

  let closingCount = 0
  for (const closing of closings) {
    await syncClosingTransactions(companyId, closing.id, closing)
    closingCount++
  }

  let purchaseCount = 0
  for (const purchase of purchases) {
    await syncPurchaseTransaction(companyId, purchase.id, purchase)
    purchaseCount++
  }

  return { closings: closingCount, purchases: purchaseCount }
}
