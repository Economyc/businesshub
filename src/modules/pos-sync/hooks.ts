import { useState, useEffect, useCallback, useRef } from 'react'
import { useCompany } from '@/core/hooks/use-company'
import { posService } from './services'
import { getCachedVentas, saveVentasToCache, enumerateDates, getTodayStr } from './cache-service'
import type { PosLocal, PosVenta, PosProducto } from './types'

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
  const fetch = useCallback(async (localIds: number[], f1: string, f2: string) => {
    const startDate = f1.slice(0, 10)
    const endDate = f2.slice(0, 10)
    const today = getTodayStr()

    setLoading(true)
    setError(null)
    setRateLimited(false)

    // --- Step 1: Try Firestore cache ---
    let cachedVentas: PosVenta[] = []
    let rangeFullyCached = false

    if (companyId) {
      try {
        const entries = await getCachedVentas(companyId, startDate, endDate)

        if (entries.length > 0) {
          // Build ventas from cache (only requested locals)
          const localIdSet = new Set(localIds)
          cachedVentas = entries
            .filter((e) => localIdSet.has(e.localId))
            .flatMap((e) => e.ventas)

          // Check if the entire range is "frozen" (all dates older than today)
          // AND all date+local combos are cached
          if (endDate < today) {
            const allDates = enumerateDates(startDate, endDate)
            const cachedKeys = new Set(entries.map((e) => `${e.date}_${e.localId}`))
            rangeFullyCached = allDates.every((date) =>
              localIds.every((lid) => cachedKeys.has(`${date}_${lid}`))
            )
          }
        }
      } catch {
        // Cache read failed, continue with API fetch
      }
    }

    // --- Step 2: If fully cached (all dates in the past), return immediately ---
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

    // --- Step 4: Fetch from API ---
    try {
      const result = await posService.getVentasBatch(localIds, f1, f2)
      setVentas(result.ventas)
      setLastUpdated(new Date())
      setFromCache(false)
      if (result.rateLimited) {
        setRateLimited(true)
      }

      // --- Step 5: Save to Firestore cache (fire and forget) ---
      if (companyId) {
        saveVentasToCache(companyId, result.ventas, localIds, startDate, endDate).catch(() => {})
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      // If we had cached data, keep showing it
      if (cachedVentas.length === 0) setVentas([])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  return { ventas, loading, error, rateLimited, lastUpdated, fromCache, fetch }
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
