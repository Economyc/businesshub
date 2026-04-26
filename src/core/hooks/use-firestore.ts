import { useQuery } from '@tanstack/react-query'
import { fetchCollection, fetchDocument } from '@/core/firebase/helpers'
import { useCompany } from './use-company'

// `useCollection` trae la colección completa de la company activa sin filtros.
// No acepta `QueryConstraint` porque el `queryKey` no puede serializarlos de
// forma estable: dos llamadas con where distintos producirían la misma key y
// React Query deduplicaría pisando datos entre pantallas. Si necesitas filtrar,
// crea un hook específico con queryKey explícito (ej. useTransactionsInRange).
//
// `staleTime: 5min` evita que cada remount entre módulos abra un canal a
// Firestore para revalidar. Con persistentLocalCache la lectura es desde
// IndexedDB, pero el SDK aun así abre canal de verificación; con stale time
// React Query corta antes de pedir.
const COLLECTION_STALE_MS = 5 * 60 * 1000

export function useCollection<T>(collectionName: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, collectionName],
    queryFn: () => fetchCollection<T>(companyId!, collectionName),
    enabled: !!companyId,
    staleTime: COLLECTION_STALE_MS,
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
    staleTime: COLLECTION_STALE_MS,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error as Error | null,
  }
}
