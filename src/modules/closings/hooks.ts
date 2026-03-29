import { useCollection } from '@/core/hooks/use-firestore'
import type { Closing, Discount } from './types'

export function useClosings() {
  return useCollection<Closing>('closings')
}

export function useDiscounts() {
  return useCollection<Discount>('discounts')
}
