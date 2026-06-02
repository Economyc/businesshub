import { useCollection } from '@/core/hooks/use-firestore'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { itemsService, ITEMS_COLLECTION } from '../services/items.service'
import type { InventoryItem, InventoryItemFormData } from '../types'

/** Lista de insumos de la company activa. */
export function useInventoryItems() {
  return useCollection<InventoryItem>(ITEMS_COLLECTION)
}

/** Mutaciones CRUD de insumos con invalidación automática de la colección. */
export function useInventoryItemMutations() {
  const create = useFirestoreMutation(
    ITEMS_COLLECTION,
    (companyId: string, data: InventoryItemFormData) => itemsService.create(companyId, data),
  )

  const update = useFirestoreMutation(
    ITEMS_COLLECTION,
    (companyId: string, { id, data }: { id: string; data: Partial<InventoryItemFormData> }) =>
      itemsService.update(companyId, id, data),
  )

  const remove = useFirestoreMutation(
    ITEMS_COLLECTION,
    (companyId: string, id: string) => itemsService.remove(companyId, id),
    { optimisticDelete: true },
  )

  return { create, update, remove }
}
