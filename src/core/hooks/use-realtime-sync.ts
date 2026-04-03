import { useEffect, useRef } from 'react'
import { onSnapshot, query } from 'firebase/firestore'
import { companyCollection } from '@/core/firebase/helpers'
import { queryClient } from '@/core/query/query-client'
import { useCompany } from './use-company'

export function useRealtimeSync(collectionName: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const isFirstSnapshot = useRef(true)

  useEffect(() => {
    if (!companyId) return

    isFirstSnapshot.current = true
    const ref = companyCollection(companyId, collectionName)
    const q = query(ref)

    const unsubscribe = onSnapshot(q, () => {
      if (isFirstSnapshot.current) {
        isFirstSnapshot.current = false
        return
      }

      queryClient.invalidateQueries({
        queryKey: ['firestore', companyId, collectionName],
      })
      queryClient.invalidateQueries({
        queryKey: ['firestore-paginated', companyId, collectionName],
      })
      queryClient.invalidateQueries({
        queryKey: ['firestore-count', companyId, collectionName],
      })
    })

    return unsubscribe
  }, [companyId, collectionName])
}
