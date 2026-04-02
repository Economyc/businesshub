import { useMutation } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { queryClient } from './query-client'
import { invalidateCollection } from './invalidation'

interface MutationOptions {
  /** Additional collections to invalidate on success */
  invalidate?: string[]
  /** Enable optimistic delete — removes item from cache immediately */
  optimisticDelete?: boolean
}

/**
 * Generic mutation hook for Firestore operations.
 * Auto-invalidates the collection (and paginated queries) on success.
 * Supports optimistic deletes for instant UI feedback.
 */
export function useFirestoreMutation<TVariables, TData = unknown>(
  collectionName: string,
  mutationFn: (companyId: string, variables: TVariables) => Promise<TData>,
  options?: MutationOptions,
) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(companyId, variables),

    onMutate: async (variables) => {
      if (!options?.optimisticDelete) return

      // Cancel outgoing queries for this collection
      await queryClient.cancelQueries({ queryKey: ['firestore', companyId, collectionName] })
      await queryClient.cancelQueries({ queryKey: ['firestore-paginated', companyId, collectionName] })

      // Snapshot previous data
      const previousCollection = queryClient.getQueryData(['firestore', companyId, collectionName])
      const previousPaginated = queryClient.getQueryData(['firestore-paginated', companyId, collectionName])

      // Optimistic remove from collection cache
      const id = (variables as any)?.id ?? variables
      queryClient.setQueryData(
        ['firestore', companyId, collectionName],
        (old: any[] | undefined) => old?.filter((item: any) => item.id !== id) ?? [],
      )

      // Optimistic remove from paginated cache
      queryClient.setQueryData(
        ['firestore-paginated', companyId, collectionName],
        (old: any) => {
          if (!old?.pages) return old
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.filter((item: any) => item.id !== id),
            })),
          }
        },
      )

      return { previousCollection, previousPaginated }
    },

    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousCollection !== undefined) {
        queryClient.setQueryData(['firestore', companyId, collectionName], context.previousCollection)
      }
      if (context?.previousPaginated !== undefined) {
        queryClient.setQueryData(['firestore-paginated', companyId, collectionName], context.previousPaginated)
      }
    },

    onSettled: () => {
      // Always invalidate to get fresh data from server
      invalidateCollection(companyId, collectionName)
      queryClient.invalidateQueries({ queryKey: ['firestore-paginated', companyId, collectionName] })
      queryClient.invalidateQueries({ queryKey: ['firestore-count', companyId, collectionName] })

      // Invalidate additional collections
      options?.invalidate?.forEach((col) => {
        invalidateCollection(companyId, col)
        queryClient.invalidateQueries({ queryKey: ['firestore-paginated', companyId, col] })
      })
    },
  })
}
