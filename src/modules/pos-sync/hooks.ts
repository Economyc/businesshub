import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import { useCompany } from '@/core/hooks/use-company'
import { posService, PosRateLimitError } from './services'
import {
  getCachedVentas,
  saveVentasToCache,
  getCachedCatalogo,
  saveCatalogoToCache,
  enumerateDates,
  getTodayStr,
  isLikelyPartialResponse,
} from './cache-service'
import type { PosLocal, PosVenta, PosProducto } from './types'

const MAX_DAYS = 33
const AUTO_REFRESH_MS = 5 * 60 * 1000
const STALE_TIME_MS = 2 * 60 * 1000
const GC_TIME_MS = 10 * 60 * 1000

// Si el server reconcile lleva más de este tiempo corriendo, asumimos que
// murió sin soltar el flag (crash, timeout que omitió el finally). Permitir
// que el cliente vuelva a fetchear en ese caso.
const RECONCILE_STUCK_MS = 60 * 60 * 1000

async function isServerReconcileActive(companyId: string): Promise<boolean> {
  try {
    const ref = doc(db, 'companies', companyId, 'settings', 'pos-reconcile-meta')
    const snap = await getDoc(ref)
    if (!snap.exists()) return false
    const data = snap.data() as { inProgress?: boolean; startedAt?: Timestamp }
    if (!data.inProgress) return false
    const startedMs = data.startedAt?.toMillis?.() ?? 0
    if (!startedMs) return true
    return Date.now() - startedMs < RECONCILE_STUCK_MS
  } catch {
    return false
  }
}

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
  force?: boolean
  onProgress?: (p: FetchProgress | null) => void
  onPartial?: (partial: FetchResult) => void
}

const PARALLEL_CHUNKS = 2

async function fetchVentasWithCache({
  companyId,
  localIds,
  startDate,
  endDate,
  force = false,
  onProgress,
  onPartial,
}: FetchArgs): Promise<FetchResult> {
  const today = getTodayStr()
  const localIdSet = new Set(localIds)

  let cachedVentas: PosVenta[] = []
  let freshKeys = new Set<string>()
  let staleKeys = new Set<string>()
  let allCachedVentas: PosVenta[] = []

  if (companyId) {
    try {
      const lookup = await getCachedVentas(companyId, startDate, endDate)
      allCachedVentas = lookup.ventas
      cachedVentas = lookup.ventas.filter((v) => localIdSet.has(v.id_local))
      if (!force) {
        freshKeys = lookup.freshKeys
        staleKeys = lookup.staleKeys
      }
    } catch {
      // Cache read failed — fall through to full fetch
    }
  }

  // Si el server está reconciliando en este momento, no competir por el token
  // POS. Mostrar cache actual y dejar que React Query reintente en el próximo
  // refetch; el Home poll cada 30s y dispara refetch al detectar que terminó.
  // Aplica a todos los rangos: aunque el usuario filtre "Hoy" o 7 días, si el
  // server está corriendo el POS rechaza las llamadas concurrentes y
  // terminamos con respuestas de 0 ventas que contaminan logs y disparan la
  // guarda anti-partial.
  if (companyId && !force) {
    const serverActive = await isServerReconcileActive(companyId)
    // Solo ceder el turno al server si tenemos cache útil que mostrar.
    // Si cache está vacía (ej: escrituras bloqueadas por adblocker), seguir
    // con el fetch al POS — peor dar datos parciales que borrar la UI.
    if (serverActive && cachedVentas.length > 0) {
      return { ventas: cachedVentas, fromCache: true, rateLimited: false }
    }
  }

  // Build per-day×local count + index of cached ventas to detect partial POS responses
  const previousCountByKey = new Map<string, number>()
  const previousVentasByKey = new Map<string, PosVenta[]>()
  for (const v of allCachedVentas) {
    const vDate = v.fecha?.slice(0, 10)
    if (!vDate) continue
    const key = `${vDate}_${v.id_local}`
    previousCountByKey.set(key, (previousCountByKey.get(key) ?? 0) + 1)
    if (!previousVentasByKey.has(key)) previousVentasByKey.set(key, [])
    previousVentasByKey.get(key)!.push(v)
  }
  // Determine which dates still need to be fetched (a date needs fetch if any local for that date is missing/stale)
  const allDates = enumerateDates(startDate, endDate)
  const datesNeedingFetch: string[] = []
  for (const date of allDates) {
    if (force) {
      datesNeedingFetch.push(date)
      continue
    }
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

  // Compute cache coverage: how many days actually have cached sales (vs. just meta entries).
  const datesWithCache = new Set<string>()
  for (const v of cachedVentas) {
    const vDate = v.fecha?.slice(0, 10)
    if (vDate) datesWithCache.add(vDate)
  }
  const coverageRatio =
    allDates.length === 0 ? 0 : datesWithCache.size / allDates.length
  const hasUsableCache = cachedVentas.length > 0 && coverageRatio >= 0.5

  // Remove cached ventas for dates we're about to refetch
  const redoDates = new Set(datesNeedingFetch)
  const accumulated: PosVenta[] = cachedVentas.filter(
    (v) => !redoDates.has(v.fecha?.slice(0, 10) ?? ''),
  )

  // If we have usable cache, show it immediately so the UI doesn't block on reconciliation.
  // The reconciliation continues in the background and the dot indicator shows the activity.
  if (hasUsableCache) {
    onPartial?.({ ventas: cachedVentas, fromCache: true, rateLimited: false })
  }
  const isWarmReload = hasUsableCache

  const showProgress = chunksToFetch.length > 1
  let rateLimited = false
  let completed = 0
  let aborted = false

  const runChunk = async (chunk: { start: string; end: string }) => {
    const chunkF1 = `${chunk.start} 00:00:00`
    const chunkF2 = `${chunk.end} 23:59:59`
    const result = await posService.getVentasBatch(localIds, chunkF1, chunkF2)
    if (result.rateLimited) rateLimited = true

    // Group new ventas by date_local key
    const newByKey = new Map<string, PosVenta[]>()
    for (const v of result.ventas) {
      if (!localIdSet.has(v.id_local)) continue
      const vDate = v.fecha?.slice(0, 10)
      if (!vDate) continue
      const key = `${vDate}_${v.id_local}`
      if (!newByKey.has(key)) newByKey.set(key, [])
      newByKey.get(key)!.push(v)
    }

    // For each (date, local) covered by this chunk, prefer the new payload unless
    // it's clearly a partial response — in that case keep the cached version.
    for (const date of enumerateDates(chunk.start, chunk.end)) {
      for (const lid of localIds) {
        const key = `${date}_${lid}`
        const newGroup = newByKey.get(key) ?? []
        const prevCount = previousCountByKey.get(key) ?? 0
        if (isLikelyPartialResponse(newGroup.length, prevCount)) {
          const prevGroup = previousVentasByKey.get(key) ?? []
          accumulated.push(...prevGroup)
        } else {
          accumulated.push(...newGroup)
        }
      }
    }

    if (companyId) {
      saveVentasToCache(
        companyId,
        result.ventas,
        localIds,
        chunk.start,
        chunk.end,
        previousCountByKey,
      ).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[pos-sync] saveVentasToCache failed', err)
      })
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
        // If nothing was fetched yet, let React Query retry with exponential backoff.
        // If we already got some chunks, keep the partial progress and surface the
        // rate-limited flag so the UI shows the warning alongside the partial data.
        if (completed === 0) throw err
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
  const forceRef = useRef(false)

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
    placeholderData: keepPreviousData,
    retry: (failureCount, error) =>
      error instanceof PosRateLimitError && failureCount < 3,
    retryDelay: (attempt) => Math.min(2 ** attempt * 1000, 30_000),
    queryFn: async () => {
      setProgress(null)
      const force = forceRef.current
      forceRef.current = false
      return fetchVentasWithCache({
        companyId,
        localIds: sortedLocalIds,
        startDate,
        endDate,
        force,
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

  const forceRefresh = useCallback(() => {
    forceRef.current = true
    return query.refetch()
  }, [query])

  const data = query.data
  const isFetching = query.isFetching

  const hardRateLimited = query.error instanceof PosRateLimitError
  return {
    ventas: data?.ventas ?? [],
    loading: isFetching,
    error: query.error && !hardRateLimited ? query.error.message : null,
    rateLimited: (data?.rateLimited ?? false) || hardRateLimited,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    fromCache: data?.fromCache ?? false,
    progress,
    refetch,
    forceRefresh,
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
