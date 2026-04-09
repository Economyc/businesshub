import { useState, useEffect, useCallback } from 'react'
import { posService } from './services'
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
  const [ventas, setVentas] = useState<PosVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (localIds: number[], f1: string, f2: string) => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        localIds.map((id) => posService.getVentas(id, f1, f2))
      )
      setVentas(results.flat())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setVentas([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { ventas, loading, error, fetch }
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
