import { useQuery } from '@tanstack/react-query'
import { fetchCollection, fetchDocument } from '@/core/firebase/helpers'
import { useCompany } from './use-company'

// `useCollection` trae la colección completa de la company activa sin filtros.
// No acepta `QueryConstraint` porque el `queryKey` no puede serializarlos de
// forma estable: dos llamadas con where distintos producirían la misma key y
// React Query deduplicaría pisando datos entre pantallas. Si necesitas filtrar,
// crea un hook específico con queryKey explícito (ej. useTransactionsInRange).
export function useCollection<T>(collectionName: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, collectionName],
    queryFn: () => fetchCollection<T>(companyId!, collectionName),
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
