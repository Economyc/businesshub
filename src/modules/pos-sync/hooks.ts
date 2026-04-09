import { useState, useEffect, useCallback, useRef } from 'react'
import { posService, PosRateLimitError } from './services'
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

// --- Cache helpers ---
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

interface CachedData {
  ventas: PosVenta[]
  timestamp: number
}

function cacheKey(localIds: number[], f1: string, f2: string): string {
  return `pos-ventas-${[...localIds].sort().join(',')}-${f1}-${f2}`
}

function getCached(key: string): CachedData | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as CachedData
  } catch { return null }
}

function setCache(key: string, ventas: PosVenta[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ventas, timestamp: Date.now() }))
  } catch { /* storage full, ignore */ }
}

export function usePosVentas() {
  const [ventas, setVentas] = useState<PosVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const hasFetched = useRef(false)

  const fetch = useCallback(async (localIds: number[], f1: string, f2: string) => {
    const key = cacheKey(localIds, f1, f2)

    // Load cache immediately if available
    const cached = getCached(key)
    if (cached) {
      setVentas(cached.ventas)
      setLastUpdated(new Date(cached.timestamp))
      setFromCache(true)
    }

    setLoading(true)
    setError(null)
    setRateLimited(false)
    try {
      // Serialize requests (one local at a time) with delay to respect API cooldown
      const allVentas: PosVenta[] = []
      for (let i = 0; i < localIds.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 6000))
        try {
          const localVentas = await posService.getVentas(localIds[i], f1, f2)
          allVentas.push(...localVentas)
        } catch (err: unknown) {
          if (err instanceof PosRateLimitError) {
            // Keep what we got so far + cache/previous data
            if (allVentas.length > 0) {
              setVentas(allVentas)
              setLastUpdated(new Date())
              setFromCache(false)
              setCache(key, allVentas)
            }
            setRateLimited(true)
            setLoading(false)
            return
          }
          throw err
        }
      }
      setVentas(allVentas)
      setLastUpdated(new Date())
      setFromCache(false)
      setCache(key, allVentas)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      if (!cached) setVentas([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { ventas, loading, error, rateLimited, lastUpdated, fromCache, fetch, hasFetched }
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
