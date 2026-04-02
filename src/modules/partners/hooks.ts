import { useCollection } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy } from 'firebase/firestore'
import type { Partner } from './types'

export function usePartners() {
  return useCollection<Partner>('partners')
}

export function usePaginatedPartners() {
  return usePaginatedCollection<Partner>('partners', 50, orderBy('createdAt', 'desc'))
}
