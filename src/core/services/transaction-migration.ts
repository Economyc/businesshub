import { fetchCollection } from '@/core/firebase/helpers'
import { syncClosingTransactions } from './transaction-sync'
import type { Closing } from '@/modules/closings/types'

export async function migrateExistingData(companyId: string): Promise<{ closings: number }> {
  const closings = await fetchCollection<Closing>(companyId, 'closings')

  let closingCount = 0
  for (const closing of closings) {
    await syncClosingTransactions(companyId, closing.id, closing)
    closingCount++
  }

  return { closings: closingCount }
}
