import { useState, useEffect, useCallback, useRef } from 'react'
import { useCompany } from '@/core/hooks/use-company'
import { posService, PosRateLimitError } from './services'
import { getCachedVentas, saveVentasToCache, enumerateDates, getTodayStr } from './cache-service'
import type { PosLocal, PosVenta, PosProducto } from './types'

const MAX_DAYS = 33

export interface FetchProgress {
  current: number
  total: number
}

function splitIntoChunks(startDate: string, endDate: string): { start: string; end: string }[] {
  const chunks: { start: string; end: string }[] = []
  const end = new Date(endDate + 'T12:00:00')
  let cursor = new Date(startDate + 'T12:00:00')

  while (cursor <= end) {
    const chunkEnd = new Date(cursor)
    chunkEnd.setDate(chunkEnd.getDate() + MAX_DAYS - 1)
    if (chunkEnd > end) chunkEnd.setTime(end.getTime())

    const fmt = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    chunks.push({ start: fmt(cursor), end: fmt(chunkEnd) })
    cursor = new Date(chunkEnd)
    cursor.setDate(cursor.getDate() + 1)
  }

  return chunks
}

export function usePosLocales() {
  const [locales, setLocales] = useState<PosLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    posService.getDominio()
      .then((data) => {
        if (!cancelled) setLocales(data?.locales ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { locales, loading, error }
}

export function usePosVentas() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const [ventas, setVentas] = useState<PosVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [progress, setProgress] = useState<FetchProgress | null>(null)

  const fetch = useCallback(async (localIds: number[], f1: string, f2: string) => {
    const startDate = f1.slice(0, 10)
    const endDate = f2.slice(0, 10)
    const today = getTodayStr()

    setLoading(true)
    setError(null)
    setRateLimited(false)
    setProgress(null)

    // --- Step 1: Try Firestore cache for full range ---
    let cachedVentas: PosVenta[] = []
    let rangeFullyCached = false
    let cachedKeys = new Set<string>()

    if (companyId) {
      try {
        const entries = await getCachedVentas(companyId, startDate, endDate)

        if (entries.length > 0) {
          const localIdSet = new Set(localIds)
          cachedVentas = entries
            .filter((e) => localIdSet.has(e.localId))
            .flatMap((e) => e.ventas)

          cachedKeys = new Set(entries.map((e) => `${e.date}_${e.localId}`))

          if (endDate < today) {
            const allDates = enumerateDates(startDate, endDate)
            rangeFullyCached = allDates.every((date) =>
              localIds.every((lid) => cachedKeys.has(`${date}_${lid}`))
            )
          }
        }
      } catch {
        // Cache read failed, continue with API fetch
      }
    }

    // --- Step 2: If fully cached, return immediately ---
    if (rangeFullyCached) {
      setVentas(cachedVentas)
      setFromCache(true)
      setLastUpdated(new Date())
      setLoading(false)
      return
    }

    // --- Step 3: Show cached preview while API loads ---
    if (cachedVentas.length > 0) {
      setVentas(cachedVentas)
      setFromCache(true)
    }

    // --- Step 4: Split into chunks and fetch only uncached ones ---
    const chunks = splitIntoChunks(startDate, endDate)

    // Determine which chunks need API calls
    const uncachedChunks = chunks.filter((chunk) => {
      // If chunk ends in the past AND all dates are cached, skip it
      if (chunk.end < today) {
        const chunkDates = enumerateDates(chunk.start, chunk.end)
        const fullyCached = chunkDates.every((date) =>
          localIds.every((lid) => cachedKeys.has(`${date}_${lid}`))
        )
        if (fullyCached) return false
      }
      return true
    })

    if (uncachedChunks.length === 0) {
      // All chunks cached — shouldn't happen (rangeFullyCached would've caught it)
      // but handle gracefully
      setVentas(cachedVentas)
      setFromCache(true)
      setLastUpdated(new Date())
      setLoading(false)
      return
    }

    // --- Step 5: Fetch uncached chunks sequentially ---
    const allApiVentas: PosVenta[] = [...cachedVentas]
    // Remove ventas that belong to chunks we're about to re-fetch
    const uncachedRanges = new Set<string>()
    for (const chunk of uncachedChunks) {
      for (const date of enumerateDates(chunk.start, chunk.end)) {
        uncachedRanges.add(date)
      }
    }
    const keptCachedVentas = allApiVentas.filter(
      (v) => !uncachedRanges.has(v.fecha?.slice(0, 10) ?? '')
    )
    allApiVentas.length = 0
    allApiVentas.push(...keptCachedVentas)

    const showProgress = uncachedChunks.length > 1
    let hitRateLimit = false

    try {
      for (let i = 0; i < uncachedChunks.length; i++) {
        const chunk = uncachedChunks[i]
        if (showProgress) setProgress({ current: i + 1, total: uncachedChunks.length })

        const chunkF1 = `${chunk.start} 00:00:00`
        const chunkF2 = `${chunk.end} 23:59:59`

        try {
          const result = await posService.getVentasBatch(localIds, chunkF1, chunkF2)
          allApiVentas.push(...result.ventas)
          setVentas([...allApiVentas])
          setFromCache(false)

          if (result.rateLimited) hitRateLimit = true

          // Save chunk to cache (fire and forget)
          if (companyId) {
            saveVentasToCache(companyId, result.ventas, localIds, chunk.start, chunk.end).catch(() => {})
          }
        } catch (err: unknown) {
          if (err instanceof PosRateLimitError) {
            hitRateLimit = true
            // Show what we have so far and stop
            break
          }
          throw err
        }
      }

      setLastUpdated(new Date())
      if (hitRateLimit) setRateLimited(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      // If we had accumulated data, keep showing it
      if (allApiVentas.length === 0) setVentas([])
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [companyId])

  return { ventas, loading, error, rateLimited, lastUpdated, fromCache, fetch, progress }
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
  const [productos, setProductos] = useState<PosProducto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (localId: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await posService.getCatalogo(localId)
      setProductos(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setProductos([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { productos, loading, error, fetch }
}
