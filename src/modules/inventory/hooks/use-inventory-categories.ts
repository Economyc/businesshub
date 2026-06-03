import { useEffect } from 'react'
import { useCollection } from '@/core/hooks/use-firestore'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { categoriesService, CATEGORIES_COLLECTION } from '../services/categories.service'
import { DEFAULT_INVENTORY_CATEGORIES } from '../domain/default-categories'
import type { InventoryCategory, InventoryCategoryFormData } from '../types'

// Companies ya sembradas en esta sesión: evita que el efecto re-dispare la
// siembra mientras el create+refetch está en vuelo (data sigue vacía un instante).
const seeded = new Set<string>()

/**
 * Catálogo de categorías de insumos de la company activa.
 * Auto-siembra el set estándar la primera vez que la colección está vacía.
 */
export function useInventoryCategories() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const result = useCollection<InventoryCategory>(CATEGORIES_COLLECTION)
  const { data, loading, refetch } = result

  useEffect(() => {
    if (!companyId || loading || data.length > 0 || seeded.has(companyId)) return
    seeded.add(companyId)
    ;(async () => {
      try {
        for (const name of DEFAULT_INVENTORY_CATEGORIES) {
          await categoriesService.create(companyId, { name })
        }
        await refetch()
      } catch {
        seeded.delete(companyId) // permite reintentar en el próximo render
      }
    })()
  }, [companyId, loading, data.length, refetch])

  return result
}

/** Mutaciones CRUD del catálogo con invalidación automática de la colección. */
export function useInventoryCategoryMutations() {
  const create = useFirestoreMutation(
    CATEGORIES_COLLECTION,
    (companyId: string, data: InventoryCategoryFormData) => categoriesService.create(companyId, data),
  )

  const update = useFirestoreMutation(
    CATEGORIES_COLLECTION,
    (companyId: string, { id, data }: { id: string; data: Partial<InventoryCategoryFormData> }) =>
      categoriesService.update(companyId, id, data),
  )

  const remove = useFirestoreMutation(
    CATEGORIES_COLLECTION,
    (companyId: string, id: string) => categoriesService.remove(companyId, id),
    { optimisticDelete: true },
  )

  return { create, update, remove }
}
