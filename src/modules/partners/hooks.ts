import { useCollection } from '@/core/hooks/use-firestore'
import type { Partner } from './types'

export function usePartners() {
  return useCollection<Partner>('partners')
}
