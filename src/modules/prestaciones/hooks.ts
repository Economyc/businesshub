import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import type { SettlementRecord, SettlementFormData } from './types'

export function useSettlements() {
  return useCollection<SettlementRecord>('settlements')
}

export function useSettlement(id: string | undefined) {
  return useDocument<SettlementRecord>('settlements', id)
}

export function useSettlementMutation() {
  return useFirestoreMutation<{ id?: string } & Partial<SettlementFormData>>(
    'settlements',
    async (companyId, data) => {
      const { settlementService } = await import('./services')
      const { id, ...rest } = data
      if (id) await settlementService.update(companyId, id, rest)
      else await settlementService.create(companyId, rest as SettlementFormData)
    },
  )
}

export function useSettlementDelete() {
  return useFirestoreMutation<string>(
    'settlements',
    async (companyId, id) => {
      const { settlementService } = await import('./services')
      await settlementService.remove(companyId, id)
    },
    { optimisticDelete: true },
  )
}
