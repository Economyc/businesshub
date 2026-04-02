import { useQuery } from '@tanstack/react-query'
import { fetchCollection, fetchDocument } from '@/core/firebase/helpers'
import { useCompany } from './use-company'
import type { QueryConstraint } from 'firebase/firestore'

export function useCollection<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, collectionName],
    queryFn: () => fetchCollection<T>(companyId!, collectionName, ...constraints),
    enabled: !!companyId,
  })

  return {
    data: data ?? [],
    loading: isLoading,
    error: error as Error | null,
    refetch,
  }
}

export function useDocument<T>(collectionName: string, docId: string | undefined) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error } = useQuery({
    queryKey: ['firestore', companyId, collectionName, docId],
    queryFn: () => fetchDocument<T>(companyId!, collectionName, docId!),
    enabled: !!companyId && !!docId,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error as Error | null,
  }
}
