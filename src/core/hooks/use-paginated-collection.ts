import { useMemo, useCallback } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchPaginatedCollection, fetchCollectionCount } from '@/core/firebase/paginated-helpers'
import { useCompany } from './use-company'
import type { QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore'

const DEFAULT_PAGE_SIZE = 50

export interface PaginatedCollectionResult<T> {
  data: T[]
  loading: boolean
  loadingMore: boolean
  error: Error | null
  hasMore: boolean
  totalCount: number | null
  loadMore: () => void
  refetch: () => void
}

export function usePaginatedCollection<T>(
  collectionName: string,
  pageSize: number = DEFAULT_PAGE_SIZE,
  ...constraints: QueryConstraint[]
): PaginatedCollectionResult<T> {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const {
    data: infiniteData,
    isLoading,
    isFetchingNextPage,
    error,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['firestore-paginated', companyId, collectionName],
    queryFn: async ({ pageParam }: { pageParam: QueryDocumentSnapshot | null }) => {
      return fetchPaginatedCollection<T>(companyId!, collectionName, pageSize, pageParam, ...constraints)
    },
    initialPageParam: null as QueryDocumentSnapshot | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    enabled: !!companyId,
  })

  const { data: totalCount } = useQuery({
    queryKey: ['firestore-count', companyId, collectionName],
    queryFn: () => fetchCollectionCount(companyId!, collectionName),
    enabled: !!companyId,
  })

  const data = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.items) ?? [],
    [infiniteData]
  )

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return {
    data,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    error: error as Error | null,
    hasMore: hasNextPage ?? false,
    totalCount: totalCount ?? null,
    loadMore,
    refetch,
  }
}
