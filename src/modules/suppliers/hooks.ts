import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy } from 'firebase/firestore'
import type { Supplier } from './types'

export function useSuppliers() {
  return useCollection<Supplier>('suppliers')
}

export function usePaginatedSuppliers() {
  return usePaginatedCollection<Supplier>('suppliers', 50, orderBy('createdAt', 'desc'))
}

export function useSupplier(id: string | undefined) {
  return useDocument<Supplier>('suppliers', id)
}
