import { useCollection } from '@/core/hooks/use-firestore'
import type { Discount } from './types'

export function useDiscounts() {
  return useCollection<Discount>('discounts')
}
