import { useCollection } from '@/core/hooks/use-firestore'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { recipesService, RECIPES_COLLECTION } from '../services/recipes.service'
import type { Recipe, RecipeFormData } from '../types'

/** Lista de recetas (productos + preparaciones) de la company activa. */
export function useRecipes() {
  return useCollection<Recipe>(RECIPES_COLLECTION)
}

/** Mutaciones CRUD de recetas con invalidación automática de la colección. */
export function useRecipeMutations() {
  const create = useFirestoreMutation(
    RECIPES_COLLECTION,
    (companyId: string, data: RecipeFormData) => recipesService.create(companyId, data),
  )

  const update = useFirestoreMutation(
    RECIPES_COLLECTION,
    (companyId: string, { id, data }: { id: string; data: Partial<RecipeFormData> }) =>
      recipesService.update(companyId, id, data),
  )

  const remove = useFirestoreMutation(
    RECIPES_COLLECTION,
    (companyId: string, id: string) => recipesService.remove(companyId, id),
    { optimisticDelete: true },
  )

  return { create, update, remove }
}
