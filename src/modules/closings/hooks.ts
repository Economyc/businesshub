import { useCollection } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy } from 'firebase/firestore'
import type { Closing, Discount } from './types'

export function useClosings() {
  return useCollection<Closing>('closings')
}

export function usePaginatedClosings() {
  return usePaginatedCollection<Closing>('closings', 50, orderBy('createdAt', 'desc'))
}

export function useDiscounts() {
  return useCollection<Discount>('discounts')
}
