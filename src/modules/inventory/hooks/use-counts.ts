import { useCollection } from '@/core/hooks/use-firestore'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { countsService, COUNTS_COLLECTION } from '../services/counts.service'
import type { InventoryCount, InventoryCountFormData } from '../types'

/** Lista de conteos físicos de la company activa. */
export function useCounts() {
  return useCollection<InventoryCount>(COUNTS_COLLECTION)
}

/** Mutaciones CRUD de conteos con invalidación automática de la colección. */
export function useCountMutations() {
  const create = useFirestoreMutation(
    COUNTS_COLLECTION,
    (companyId: string, data: InventoryCountFormData) => countsService.create(companyId, data),
  )

  const update = useFirestoreMutation(
    COUNTS_COLLECTION,
    (companyId: string, { id, data }: { id: string; data: Partial<InventoryCountFormData> }) =>
      countsService.update(companyId, id, data),
  )

  const remove = useFirestoreMutation(
    COUNTS_COLLECTION,
    (companyId: string, id: string) => countsService.remove(companyId, id),
    { optimisticDelete: true },
  )

  return { create, update, remove }
}
