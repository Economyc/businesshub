import { useCollection } from '@/core/hooks/use-firestore'
import type { Closing } from './types'

export function useClosings() {
  return useCollection<Closing>('closings')
}
