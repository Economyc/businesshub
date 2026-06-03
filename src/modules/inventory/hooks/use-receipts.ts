import { useCollection } from '@/core/hooks/use-firestore'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { receiptsService, RECEIPTS_COLLECTION } from '../services/receipts.service'
import type { InventoryReceipt, InventoryReceiptFormData } from '../types'

/** Lista de entradas/compras de la company activa. */
export function useReceipts() {
  return useCollection<InventoryReceipt>(RECEIPTS_COLLECTION)
}

/** Mutaciones CRUD de entradas con invalidación automática de la colección. */
export function useReceiptMutations() {
  const create = useFirestoreMutation(
    RECEIPTS_COLLECTION,
    (companyId: string, data: InventoryReceiptFormData) => receiptsService.create(companyId, data),
  )

  const update = useFirestoreMutation(
    RECEIPTS_COLLECTION,
    (companyId: string, { id, data }: { id: string; data: Partial<InventoryReceiptFormData> }) =>
      receiptsService.update(companyId, id, data),
  )

  const remove = useFirestoreMutation(
    RECEIPTS_COLLECTION,
    (companyId: string, id: string) => receiptsService.remove(companyId, id),
    { optimisticDelete: true },
  )

  return { create, update, remove }
}
