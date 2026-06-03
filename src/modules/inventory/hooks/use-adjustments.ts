import { useCollection } from '@/core/hooks/use-firestore'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { adjustmentsService, ADJUSTMENTS_COLLECTION } from '../services/adjustments.service'
import type { InventoryAdjustment, InventoryAdjustmentFormData } from '../types'

/** Lista de ajustes/mermas de la company activa. */
export function useAdjustments() {
  return useCollection<InventoryAdjustment>(ADJUSTMENTS_COLLECTION)
}

/** Mutaciones CRUD de ajustes con invalidación automática de la colección. */
export function useAdjustmentMutations() {
  const create = useFirestoreMutation(
    ADJUSTMENTS_COLLECTION,
    (companyId: string, data: InventoryAdjustmentFormData) => adjustmentsService.create(companyId, data),
  )

  const update = useFirestoreMutation(
    ADJUSTMENTS_COLLECTION,
    (companyId: string, { id, data }: { id: string; data: Partial<InventoryAdjustmentFormData> }) =>
      adjustmentsService.update(companyId, id, data),
  )

  const remove = useFirestoreMutation(
    ADJUSTMENTS_COLLECTION,
    (companyId: string, id: string) => adjustmentsService.remove(companyId, id),
    { optimisticDelete: true },
  )

  return { create, update, remove }
}
