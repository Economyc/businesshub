import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import type { Supplier } from './types'

export function useSuppliers() {
  return useCollection<Supplier>('suppliers')
}

export function useSupplier(id: string | undefined) {
  return useDocument<Supplier>('suppliers', id)
}
