import { useState, useEffect, useCallback } from 'react'
import { fetchCollection, fetchDocument } from '@/core/firebase/helpers'
import { useCompany } from './use-company'
import { cacheGet, cacheSet } from '@/core/utils/cache'
import type { QueryConstraint } from 'firebase/firestore'

export function useCollection<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
) {
  const { selectedCompany } = useCompany()
  const cacheKey = selectedCompany ? `col:${selectedCompany.id}:${collectionName}` : ''
  const cached = cacheKey ? cacheGet<T[]>(cacheKey) : null

  const [data, setData] = useState<T[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!selectedCompany) return
    if (!cached) setLoading(true)
    setError(null)
    try {
      const result = await fetchCollection<T>(selectedCompany.id, collectionName, ...constraints)
      setData(result)
      cacheSet(`col:${selectedCompany.id}:${collectionName}`, result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id, collectionName])

  useEffect(() => {
    // When company changes, load cache for new company immediately
    if (selectedCompany) {
      const newCache = cacheGet<T[]>(`col:${selectedCompany.id}:${collectionName}`)
      if (newCache) {
        setData(newCache)
        setLoading(false)
      } else {
        setData([])
        setLoading(true)
      }
    }
    refetch()
  }, [refetch, selectedCompany?.id, collectionName])

  return { data, loading, error, refetch }
}

export function useDocument<T>(collectionName: string, docId: string | undefined) {
  const { selectedCompany } = useCompany()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!selectedCompany || !docId) return
    setLoading(true)
    setError(null)
    fetchDocument<T>(selectedCompany.id, collectionName, docId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err : new Error('Unknown error')))
      .finally(() => setLoading(false))
  }, [selectedCompany?.id, collectionName, docId])

  return { data, loading, error }
}
