import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { posService, PosRateLimitError } from './services'
import {
  getCachedVentas,
  saveVentasToCache,
  getCachedCatalogo,
  saveCatalogoToCache,
  enumerateDates,
  getTodayStr,
} from './cache-service'
import type { PosLocal, PosVenta, PosProducto } from './types'

const MAX_DAYS = 33
const AUTO_REFRESH_MS = 5 * 60 * 1000
const STALE_TIME_MS = 2 * 60 * 1000
const GC_TIME_MS = 10 * 60 * 1000

export interface FetchProgress {
  current: number
  total: number
}

interface FetchResult {
  ventas: PosVenta[]
  fromCache: boolean
  rateLimited: boolean
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nextDay(date: string): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return fmtDate(d)
}

// Build minimal chunks (capped at MAX_DAYS) covering only the dates that actually need to be fetched.
// Contiguous missing days are merged into a single request; non-contiguous gaps stay separate.
function buildFetchChunks(
  missingDates: string[],
): { start: string; end: string }[] {
  if (missingDates.length === 0) return []
  const sorted = [...new Set(missingDates)].sort()
  const chunks: { start: string; end: string }[] = []
  let chunkStart = sorted[0]
  let chunkEnd = sorted[0]
  let chunkLen = 1

  for (let i = 1; i < sorted.length; i++) {
    const date = sorted[i]
    const expectedNext = nextDay(chunkEnd)
    if (date === expectedNext && chunkLen < MAX_DAYS) {
      chunkEnd = date
      chunkLen++
    } else {
      chunks.push({ start: chunkStart, end: chunkEnd })
      chunkStart = date
      chunkEnd = date
      chunkLen = 1
    }
  }
  chunks.push({ start: chunkStart, end: chunkEnd })
  return chunks
}

interface FetchArgs {
  companyId: string | undefined
  localIds: number[]
  startDate: string
  endDate: string
  onProgress?: (p: FetchProgress | null) => void
  onPartial?: (partial: FetchResult) => void
}

const PARALLEL_CHUNKS = 2

async function fetchVentasWithCache({
  companyId,
  localIds,
  startDate,
  endDate,
  onProgress,
  onPartial,
}: FetchArgs): Promise<FetchResult> {
  const today = getTodayStr()
  const localIdSet = new Set(localIds)

  let cachedVentas: PosVenta[] = []
  let freshKeys = new Set<string>()
  let staleKeys = new Set<string>()

  if (companyId) {
    try {
      const lookup = await getCachedVentas(companyId, startDate, endDate)
      cachedVentas = lookup.ventas.filter((v) => localIdSet.has(v.id_local))
      freshKeys = lookup.freshKeys
      staleKeys = lookup.staleKeys
    } catch {
      // Cache read failed — fall through to full fetch
    }
  }

  // Determine which dates still need to be fetched (a date needs fetch if any local for that date is missing/stale)
  const allDates = enumerateDates(startDate, endDate)
  const datesNeedingFetch: string[] = []
  for (const date of allDates) {
    let needs = false
    for (const lid of localIds) {
      const key = `${date}_${lid}`
      if (date >= today || staleKeys.has(key) || !freshKeys.has(key)) {
        needs = true
        break
      }
    }
    if (needs) datesNeedingFetch.push(date)
  }

  if (datesNeedingFetch.length === 0) {
    return { ventas: cachedVentas, fromCache: true, rateLimited: false }
  }

  const chunksToFetch = buildFetchChunks(datesNeedingFetch)
  if (chunksToFetch.length === 0) {
    return { ventas: cachedVentas, fromCache: true, rateLimited: false }
  }

  // Decide whether to throttle partial updates: if cache covers most of the range, don't flicker the UI per chunk.
  const cacheCoverage = allDates.length === 0 ? 0 : 1 - datesNeedingFetch.length / allDates.length
  const isWarmReload = cacheCoverage >= 0.8 && cachedVentas.length > 0

  // Remove cached ventas for dates we're about to refetch
  const redoDates = new Set(datesNeedingFetch)
  const accumulated: PosVenta[] = cachedVentas.filter(
    (v) => !redoDates.has(v.fecha?.slice(0, 10) ?? ''),
  )

  // Warm reload: show stable cache immediately, no per-chunk flicker
  if (isWarmReload) {
    onPartial?.({ ventas: cachedVentas, fromCache: true, rateLimited: false })
  }

  const showProgress = chunksToFetch.length > 1
  let rateLimited = false
  let completed = 0
  let aborted = false

  const runChunk = async (chunk: { start: string; end: string }) => {
    const chunkF1 = `${chunk.start} 00:00:00`
    const chunkF2 = `${chunk.end} 23:59:59`
    const result = await posService.getVentasBatch(localIds, chunkF1, chunkF2)
    accumulated.push(...result.ventas.filter((v) => localIdSet.has(v.id_local)))
    if (result.rateLimited) rateLimited = true
    if (companyId) {
      saveVentasToCache(companyId, result.ventas, localIds, chunk.start, chunk.end).catch(
        (err) => {
          // eslint-disable-next-line no-console
          console.warn('[pos-sync] saveVentasToCache failed', err)
        },
      )
    }
  }

  // Process chunks in batches of PARALLEL_CHUNKS (chronological order preserved per batch)
  for (let i = 0; i < chunksToFetch.length && !aborted; i += PARALLEL_CHUNKS) {
    const batch = chunksToFetch.slice(i, i + PARALLEL_CHUNKS)
    if (showProgress) {
      onProgress?.({
        current: Math.min(i + batch.length, chunksToFetch.length),
        total: chunksToFetch.length,
      })
    }

    try {
      await Promise.all(batch.map(runChunk))
      completed += batch.length
    } catch (err) {
      if (err instanceof PosRateLimitError) {
        rateLimited = true
        aborted = true
        break
      }
      throw err
    }

    // Emit partial only on cold load and only after each batch (not per chunk)
    if (!isWarmReload && completed < chunksToFetch.length) {
      onPartial?.({ ventas: [...accumulated], fromCache: false, rateLimited })
    }
  }

  onProgress?.(null)
  return { ventas: accumulated, fromCache: false, rateLimited }
}

export function usePosLocales() {
  const [locales, setLocales] = useState<PosLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    posService
      .getDominio()
      .then((data) => {
        if (!cancelled) setLocales(data?.locales ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { locales, loading, error }
}

interface UsePosVentasParams {
  localIds: number[]
  startDate: string
  endDate: string
  enabled?: boolean
}

export function usePosVentas({
  localIds,
  startDate,
  endDate,
  enabled = true,
}: UsePosVentasParams) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<FetchProgress | null>(null)

  const sortedLocalIds = useMemo(
    () => [...localIds].sort((a, b) => a - b),
    [localIds],
  )

  const queryKey = useMemo(
    () => ['pos-ventas', companyId, sortedLocalIds, startDate, endDate] as const,
    [companyId, sortedLocalIds, startDate, endDate],
  )

  const queryEnabled =
    enabled && !!companyId && sortedLocalIds.length > 0 && !!startDate && !!endDate

  const query = useQuery<FetchResult, Error>({
    queryKey,
    enabled: queryEnabled,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchInterval: AUTO_REFRESH_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      setProgress(null)
      return fetchVentasWithCache({
        companyId,
        localIds: sortedLocalIds,
        startDate,
        endDate,
        onProgress: setProgress,
        onPartial: (partial) => {
          queryClient.setQueryData<FetchResult>(queryKey, partial)
        },
      })
    },
  })

  const refetch = useCallback(() => {
    return query.refetch()
  }, [query])

  const data = query.data
  const isFetching = query.isFetching

  return {
    ventas: data?.ventas ?? [],
    loading: isFetching,
    error: query.error ? query.error.message : null,
    rateLimited: data?.rateLimited ?? false,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    fromCache: data?.fromCache ?? false,
    progress,
    refetch,
  }
}

export function useAutoRefresh(callback: () => void, intervalMs: number, enabled: boolean) {
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    if (!enabled) return

    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        callbackRef.current()
      }
    }, intervalMs)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        callbackRef.current()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs, enabled])
}

export function usePosCatalogo() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const [productos, setProductos] = useState<PosProducto[]>([])
  const [loading, setLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchFromPos = useCallback(
    async (localId: number): Promise<void> => {
      const data = await posService.getCatalogo(localId)
      setProductos(data)
      const now = new Date()
      setLastUpdated(now)
      setFromCache(false)
      if (companyId) {
        saveCatalogoToCache(companyId, localId, data).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[pos-sync] saveCatalogoToCache failed', err)
        })
      }
    },
    [companyId],
  )

  const load = useCallback(
    async (localId: number, { force }: { force?: boolean } = {}) => {
      setError(null)

      let cached: Awaited<ReturnType<typeof getCachedCatalogo>> = null
      if (companyId) {
        try {
          cached = await getCachedCatalogo(companyId, localId)
        } catch {
          // Cache read failed — fall through to full fetch
        }
      }

      if (cached && cached.productos.length > 0) {
        setProductos(cached.productos)
        setLastUpdated(cached.syncedAt)
        setFromCache(true)
        if (!force && cached.isFresh) return
        setIsRefreshing(true)
        try {
          await fetchFromPos(localId)
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Error desconocido')
        } finally {
          setIsRefreshing(false)
        }
        return
      }

      setLoading(true)
      try {
        await fetchFromPos(localId)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
        setProductos([])
      } finally {
        setLoading(false)
      }
    },
    [companyId, fetchFromPos],
  )

  const fetch = useCallback(
    (localId: number) => load(localId),
    [load],
  )

  const refresh = useCallback(
    (localId: number) => load(localId, { force: true }),
    [load],
  )

  return { productos, loading, isRefreshing, error, fromCache, lastUpdated, fetch, refresh }
}
