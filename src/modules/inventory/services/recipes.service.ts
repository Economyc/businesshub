import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Recipe, RecipeFormData } from '../types'

// Recetas scoped por company (companies/{id}/recipes). NO es ROOT_COLLECTION:
// las recetas son propias de cada local (ver plan §4).
const COLLECTION = 'recipes'

export const recipesService = {
  getAll: (companyId: string) => fetchCollection<Recipe>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Recipe>(companyId, COLLECTION, id),
  create: (companyId: string, data: RecipeFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<RecipeFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}

export const RECIPES_COLLECTION = COLLECTION
