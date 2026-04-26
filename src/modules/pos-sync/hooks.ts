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
  // `true` cuando detectamos que el fetch bajó significativamente vs el
  // resultado previo (ej. chunks fallaron, guard anti-degradación se activó).
  // El UI muestra dot amarillo para avisar al usuario que puede estar viendo
  // datos incompletos.
  degraded?: boolean
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
  // Si true: solo lee cache Firestore, no llama al POS ni escribe. Usado por
  // queries background de Home (año actual, año anterior, periodo anterior)
  // para no saturar el buffer de writes del SDK cuando el usuario navega
  // entre companies. El cron nocturno del server hidrata esos rangos.
  readCacheOnly?: boolean
  onProgress?: (p: FetchProgress | null) => void
  onPartial?: (partial: FetchResult) => void
}

const PARALLEL_CHUNKS = 2
const SAVE_CACHE_TIMEOUT_MS = 15_000

// Reintento para errores transitorios del POS: si el primer fetch aborta por
// timeout (AbortSignal), cae por red, o el servidor responde 5xx, esperar
// CHUNK_RETRY_DELAY_MS y reintentar 1 sola vez antes de caer al cache. La
// mayoría de fallas del POS de restaurant.pe son saturaciones momentáneas
// que ceden en pocos segundos.
const CHUNK_RETRY_DELAY_MS = 2_500

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms),
    ),
  ])
}

// Identifica errores transitorios donde reintentar tiene sentido. Excluye
// PosRateLimitError porque el servidor pidió esperar explícitamente y los
// errores 4xx porque son semánticos (auth, params malos).
function isTransientChunkError(err: unknown): boolean {
  if (err instanceof PosRateLimitError) return false
  const e = err as { name?: string; message?: string } | null
  if (!e) return false
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true
  if (e.name === 'TypeError') return true // network failure típico
  const msg = e.message ?? ''
  if (/HTTP 5\d{2}/.test(msg)) return true
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchVentasWithCache({
  companyId,
  localIds,
  startDate,
  endDate,
  force = false,
  readCacheOnly = false,
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

  // Modo read-only: usado por queries background. No fetch al POS ni writes;
  // si falta data, `usePosAnalytics`/Home verán un rango incompleto hasta que
  // el cron nocturno del server o la query prioritaria del filtro lo hidrate.
  if (readCacheOnly) {
    return { ventas: cachedVentas, fromCache: true, rateLimited: false }
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

  // Si hay cualquier venta cacheada, renderizar inmediato y reconciliar en background.
  // Antes exigíamos cobertura ≥ 50% sobre `allDates`, pero para locales con apertura
  // reciente (Escondite abrió en 2026-03) ese umbral es inalcanzable: los días previos
  // a la apertura están legítimamente vacíos y no suman al cache. Resultado: el Home
  // bloqueaba la UI con skeleton hasta completar el fetch al POS. Ahora confiamos en
  // el cache existente y dejamos que el reconcile de los días stale corra en background.
  const hasUsableCache = cachedVentas.length > 0

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

  // Fallback helper: si un chunk falla completamente (HTTP 500, network,
  // parse error antes del loop interno), recuperamos del cache los ventas
  // de sus (date, localId) para que los días no queden huérfanos en
  // `accumulated`. Sin esto, días con cache válido desaparecían de la UI
  // cada vez que falla una tanda. Marca también el resultado como degradado.
  let chunksRecoveredFromCache = 0
  const restoreChunkFromCache = (chunk: { start: string; end: string }) => {
    for (const date of enumerateDates(chunk.start, chunk.end)) {
      for (const lid of localIds) {
        const key = `${date}_${lid}`
        const prevGroup = previousVentasByKey.get(key)
        if (prevGroup && prevGroup.length > 0) accumulated.push(...prevGroup)
      }
    }
    chunksRecoveredFromCache += 1
  }

  const runChunk = async (chunk: { start: string; end: string }) => {
    const chunkF1 = `${chunk.start} 00:00:00`
    const chunkF2 = `${chunk.end} 23:59:59`
    if (!companyId) throw new Error('companyId requerido para getVentasBatch')
    const result = await posService.getVentasBatch(companyId, localIds, chunkF1, chunkF2)
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
      // Timeout contra writes que cuelgan (adblocker bloqueando Firestore /channel):
      // sin timeout, `writeBatch.commit()` no resuelve ni rechaza y acumula
      // promesas en memoria por cada refetch automático.
      withTimeout(
        saveVentasToCache(
          companyId,
          result.ventas,
          localIds,
          chunk.start,
          chunk.end,
          previousCountByKey,
        ),
        SAVE_CACHE_TIMEOUT_MS,
        'saveVentasToCache',
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

    // allSettled en vez de all: un chunk que lanza (network, 500, parse) no mata
    // los demás. El fetch YTD son 4 chunks — con `all`, un solo fallo devolvía
    // queryFn con error y React Query no reintenta errores no-rate-limit, así
    // que la UI quedaba con skeleton para siempre.
    //
    // Reintento single-shot por chunk: si el primer intento aborta por timeout
    // o falla con 5xx/red, esperar CHUNK_RETRY_DELAY_MS y reintentar. El
    // segundo fallo cae al fallback de cache (restoreChunkFromCache abajo).
    const runChunkWithRetry = async (chunk: { start: string; end: string }) => {
      try {
        return await runChunk(chunk)
      } catch (err) {
        if (!isTransientChunkError(err)) throw err
        // eslint-disable-next-line no-console
        console.warn('[pos-sync] chunk transient error, retrying once', chunk, err)
        await delay(CHUNK_RETRY_DELAY_MS)
        return await runChunk(chunk)
      }
    }
    const results = await Promise.allSettled(batch.map(runChunkWithRetry))
    for (let idx = 0; idx < results.length; idx++) {
      const r = results[idx]
      if (r.status === 'fulfilled') {
        completed += 1
        continue
      }
      if (r.reason instanceof PosRateLimitError) {
        // Rate limit sin nada útil recuperado → dejar que React Query reintente.
        if (completed === 0 && accumulated.length === cachedVentas.length) {
          throw r.reason
        }
        rateLimited = true
        aborted = true
        // Aun en rate-limit, recuperar cache del chunk para no dejar huecos.
        restoreChunkFromCache(batch[idx])
      } else {
        // Error de red/servidor en un chunk individual: marcar parcial,
        // recuperar cache de sus días y seguir.
        // eslint-disable-next-line no-console
        console.warn('[pos-sync] chunk failed, restoring cache for range', batch[idx], r.reason)
        rateLimited = true
        restoreChunkFromCache(batch[idx])
      }
    }
    if (aborted) break

    // Emit partial only on cold load and only after each batch (not per chunk)
    if (!isWarmReload && completed < chunksToFetch.length) {
      onPartial?.({ ventas: [...accumulated], fromCache: false, rateLimited })
    }
  }

  onProgress?.(null)
  const degraded = chunksRecoveredFromCache > 0
  return { ventas: accumulated, fromCache: false, rateLimited, degraded }
}

export function usePosLocales() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const [locales, setLocales] = useState<PosLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cada company pertenece a un tenant POS distinto (Blue, Filipo, …); los
    // locales visibles dependen de la company activa. Al cambiar de company
    // reseteamos para que el matching company↔local no use el dominio viejo.
    if (!companyId) {
      setLocales([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLocales([])
    setError(null)
    setLoading(true)
    posService
      .getDominio(companyId)
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
  }, [companyId])

  return { locales, loading, error }
}

interface UsePosVentasParams {
  localIds: number[]
  startDate: string
  endDate: string
  enabled?: boolean
  readCacheOnly?: boolean
}

export function usePosVentas({
  localIds,
  startDate,
  endDate,
  enabled = true,
  readCacheOnly = false,
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
      // Preservar datos previos: React Query sobrescribe el cache con el return
      // de queryFn, pisando cualquier partial que hayamos emitido. Si el fetch
      // termina vacío (chunks abortados, rate-limit parcial), devolver los
      // datos previos en lugar de un array vacío que borraría la UI.
      const previous = queryClient.getQueryData<FetchResult>(queryKey)
      const result = await fetchVentasWithCache({
        companyId,
        localIds: sortedLocalIds,
        startDate,
        endDate,
        force,
        readCacheOnly,
        onProgress: setProgress,
        onPartial: (partial) => {
          queryClient.setQueryData<FetchResult>(queryKey, partial)
        },
      })
      // Guard anti-degradación global con 2 niveles:
      //  - DROP_HARD (> 20%): muy probable chunk failed → preservar previo,
      //    marcar degraded. Evita que el usuario vea 174M → 124M falsamente.
      //  - DROP_SOFT (> 10%): posible degradación menor → mostrar nuevos,
      //    pero marcar degraded (dot amarillo) para advertir al usuario.
      //    Antes un 15% de caída se colaba como fresca sin aviso.
      // No aplica en `force` (refresh explícito) ni con previo < 20 ventas.
      const DEGRADATION_HARD_THRESHOLD = 0.8
      const DEGRADATION_SOFT_THRESHOLD = 0.9
      const MIN_PREV_FOR_GUARD = 20
      const prevCount = previous?.ventas.length ?? 0
      const prevQualifies = !force && previous && prevCount >= MIN_PREV_FOR_GUARD

      if (
        prevQualifies &&
        result.ventas.length < prevCount * DEGRADATION_HARD_THRESHOLD
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          `[pos-sync] degradación fuerte: nuevo=${result.ventas.length} < previo=${prevCount}. Preservando previo.`,
          { queryKey, rateLimited: result.rateLimited },
        )
        return {
          ...previous,
          rateLimited: result.rateLimited,
          degraded: true,
        }
      }
      if (
        result.ventas.length === 0 &&
        previous &&
        previous.ventas.length > 0
      ) {
        return { ...previous, rateLimited: result.rateLimited, degraded: true }
      }
      // Degradación suave: mostrar datos nuevos pero advertir
      if (
        prevQualifies &&
        result.ventas.length < prevCount * DEGRADATION_SOFT_THRESHOLD
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          `[pos-sync] degradación suave: nuevo=${result.ventas.length} vs previo=${prevCount}.`,
          { queryKey, rateLimited: result.rateLimited },
        )
        return { ...result, degraded: true }
      }
      return result
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
    // `isPending` es true solo en la primera carga sin data ni placeholder.
    // Distinto de `loading` (isFetching), que se activa en cada refetch.
    // El Home usa esto para decidir si mostrar skeleton vs datos parciales.
    isPending: query.isPending,
    // `isPlaceholderData` es true cuando React Query está devolviendo data de
    // una queryKey previa (keepPreviousData). Útil para distinguir "data real
    // de esta query" vs "data stale de query anterior" al cambiar company.
    isPlaceholderData: query.isPlaceholderData,
    error: query.error && !hardRateLimited ? query.error.message : null,
    rateLimited: (data?.rateLimited ?? false) || hardRateLimited,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    fromCache: data?.fromCache ?? false,
    // `true` si detectamos que el fetch se quedó corto vs el previo (chunks
    // fallaron o guard anti-degradación se activó). El Home muestra dot
    // amarillo para avisar al usuario que los números pueden no ser reales.
    degraded: data?.degraded ?? false,
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
      if (!companyId) throw new Error('companyId requerido para getCatalogo')
      const data = await posService.getCatalogo(companyId, localId)
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
