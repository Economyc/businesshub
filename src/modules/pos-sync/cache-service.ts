import { db } from '@/core/firebase/config'
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  doc,
  Timestamp,
} from 'firebase/firestore'
import type { PosVenta, PosProducto } from './types'

const SALES_COLLECTION = 'pos-sales-cache'
const META_COLLECTION = 'pos-sales-cache-meta'
const CATALOG_COLLECTION = 'pos-catalog-cache'

// Ventana de reconciliación en el cliente. Desde abril 2026 la reconciliación
// del mes actual la hace un cron nocturno (functions/src/pos-reconcile.ts,
// 01:00 America/Bogota) que hidrata el mismo cache — día 1 del mes hasta ayer.
// El cliente solo necesita un margen pequeño para cubrir el caso donde el
// cron no corrió (empresa nueva, falla puntual del POS) — con 2 días
// recuperamos ayer/anteayer sin pagar el fetch completo en cada carga.
// Meses pasados: se completan bajo demanda desde la pestaña Caché (botón
// "Reconstruir") o con "Forzar sincronización" que dispara `posReconcileOnDemand`.
export const RECONCILE_WINDOW_DAYS = 2
export const RECONCILE_TTL_MS = 24 * 60 * 60 * 1000
export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000

// Firestore acepta docs de hasta 1 MiB. Un día muy ocupado del POS (>300
// ventas con `detalle` completo) sobrepasa ese límite si se guarda en un
// solo doc. Paginamos cada `(date, localId)` en varios documentos con
// sufijo `_pN` para no perder datos. La lectura reconstruye todo desde la
// misma query por `date`.
export const MAX_VENTAS_PER_DOC = 150

export interface CacheLookup {
  ventas: PosVenta[]
  freshKeys: Set<string>
  staleKeys: Set<string>
}

interface MetaDoc {
  month: string
  days?: Record<string, Timestamp>
}

function monthsInRange(startDate: string, endDate: string): string[] {
  const result = new Set<string>()
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    result.add(`${y}-${m}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return Array.from(result)
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function getCachedVentas(
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<CacheLookup> {
  const today = getTodayStr()
  const reconcileFrom = addDays(today, -RECONCILE_WINDOW_DAYS)

  const salesRef = collection(db, 'companies', companyId, SALES_COLLECTION)
  const salesQuery = query(
    salesRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  )

  const months = monthsInRange(startDate, endDate)

  const [salesSnap, metaSnaps] = await Promise.all([
    getDocs(salesQuery),
    Promise.all(
      months.map((month) =>
        getDoc(doc(db, 'companies', companyId, META_COLLECTION, month)),
      ),
    ),
  ])

  const ventas: PosVenta[] = []
  for (const d of salesSnap.docs) {
    const data = d.data() as { ventas?: PosVenta[] }
    if (data.ventas?.length) ventas.push(...data.ventas)
  }

  const freshKeys = new Set<string>()
  const staleKeys = new Set<string>()

  for (const metaSnap of metaSnaps) {
    if (!metaSnap.exists()) continue
    const metaData = metaSnap.data() as MetaDoc
    for (const key of Object.keys(metaData.days ?? {})) {
      const date = key.split('_')[0]
      if (!date || date < startDate || date > endDate) continue
      // Cualquier día dentro de la ventana (ver RECONCILE_WINDOW_DAYS) se
      // re-fetchea desde el cliente como safety net; el cron nocturno cubre
      // los 32 días completos. `saveVentasToCache` protege contra sobreescribir
      // con respuestas parciales. Días fuera de la ventana se confían como están.
      const withinReconcile = date >= reconcileFrom && date < today
      if (withinReconcile) staleKeys.add(key)
      else freshKeys.add(key)
    }
  }

  return { ventas, freshKeys, staleKeys }
}

// Threshold below which a new fetch is considered a "partial response" relative
// to the cached version and we refuse to overwrite the existing cache.
// Bajamos de 0.7 → 0.5: el POS puede legítimamente devolver menos ventas si
// hubo anulaciones, y 0.7 era muy conservador — descartaba actualizaciones
// válidas y mantenía cache stale.
export const PARTIAL_RESPONSE_THRESHOLD = 0.5
// Umbral mínimo de ventas cacheadas para activar la guarda anti-partial.
// Días con <10 ventas previas (domingos, cierres, cache parcialmente
// poblado) se sobrescriben libremente: si no, una respuesta legítima de
// pocas ventas queda bloqueada y el hueco nunca se rellena.
// Debe mantenerse sincronizado con `functions/src/pos-cache.ts`.
export const PARTIAL_GUARD_MIN_PREV = 10

export function isLikelyPartialResponse(newCount: number, prevCount: number): boolean {
  return prevCount >= PARTIAL_GUARD_MIN_PREV && newCount < prevCount * PARTIAL_RESPONSE_THRESHOLD
}

// Cuántos docs de ventas por commit. Firestore permite hasta ~10 MiB de payload
// por commit y cada doc puede llegar a ~1 MiB, así que 6 es un techo seguro.
// Cargar un año entero de un restaurante activo puede producir cientos de docs;
// sin chunkear, el commit supera el límite y toda la escritura falla.
const MAX_SALES_DOCS_PER_BATCH = 6

export async function saveVentasToCache(
  companyId: string,
  ventas: PosVenta[],
  localIds: number[],
  startDate: string,
  endDate: string,
  previousCountByKey?: Map<string, number>,
): Promise<void> {
  const groups = new Map<string, PosVenta[]>()
  for (const v of ventas) {
    const date = v.fecha?.slice(0, 10)
    if (!date) continue
    const key = `${date}_${v.id_local}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(v)
  }

  const allDates = enumerateDates(startDate, endDate)
  const now = Timestamp.now()

  const metaUpdates = new Map<string, Record<string, Timestamp>>()
  interface PendingWrite {
    docId: string
    payload: {
      date: string
      localId: number
      page: number
      pages: number
      ventas: PosVenta[]
      syncedAt: Timestamp
    }
  }
  const pendingSalesWrites: PendingWrite[] = []

  for (const date of allDates) {
    const month = date.slice(0, 7)
    if (!metaUpdates.has(month)) metaUpdates.set(month, {})
    const monthPayload = metaUpdates.get(month)!
    for (const localId of localIds) {
      const key = `${date}_${localId}`
      const group = groups.get(key)
      const newCount = group?.length ?? 0
      const prevCount = previousCountByKey?.get(key) ?? 0

      // Skip overwriting if the new payload looks partial vs. what we already had.
      // Don't update the meta either, so the next load re-tries. Usamos
      // console.debug (no warn) porque este skip es comportamiento esperado
      // cuando cliente y server reconcile corren en paralelo; warn creaba
      // ruido innecesario en DevTools.
      if (isLikelyPartialResponse(newCount, prevCount)) {
        // eslint-disable-next-line no-console
        console.debug(
          `[pos-sync] skip overwrite for ${key}: new=${newCount} < prev=${prevCount}`,
        )
        continue
      }

      // Si el API devolvió 0 ventas y tampoco teníamos cache previa, no
      // stampar meta: un día "vacío" de primera mano puede ser una respuesta
      // parcial del POS disfrazada de cero. Dejarlo sin stamp permite que la
      // próxima carga lo reintente hasta ver datos al menos una vez.
      if (newCount === 0 && prevCount === 0) continue

      monthPayload[key] = now
      if (group && group.length > 0) {
        const pages = Math.ceil(group.length / MAX_VENTAS_PER_DOC)
        for (let p = 0; p < pages; p++) {
          const chunk = group.slice(p * MAX_VENTAS_PER_DOC, (p + 1) * MAX_VENTAS_PER_DOC)
          pendingSalesWrites.push({
            docId: `${key}_p${p}`,
            payload: {
              date,
              localId,
              page: p,
              pages,
              ventas: chunk,
              syncedAt: now,
            },
          })
        }
      }
    }
  }

  // Chunkear en múltiples batches para no exceder el límite de payload por
  // commit. Cada batch se envía secuencialmente; fallar uno no deja cache
  // totalmente incoherente porque cada doc es auto-contenido.
  for (let i = 0; i < pendingSalesWrites.length; i += MAX_SALES_DOCS_PER_BATCH) {
    const slice = pendingSalesWrites.slice(i, i + MAX_SALES_DOCS_PER_BATCH)
    const batch = writeBatch(db)
    for (const w of slice) {
      const ref = doc(db, 'companies', companyId, SALES_COLLECTION, w.docId)
      batch.set(ref, w.payload)
    }
    await batch.commit()
  }

  // Meta docs en batch separado (típicamente 1-2 docs, siempre cabe).
  const metaBatch = writeBatch(db)
  let hasMetaWrites = false
  for (const [month, days] of metaUpdates) {
    if (Object.keys(days).length === 0) continue
    const metaRef = doc(db, 'companies', companyId, META_COLLECTION, month)
    metaBatch.set(metaRef, { month, days }, { merge: true })
    hasMetaWrites = true
  }
  if (hasMetaWrites) await metaBatch.commit()
}

export function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = []
  const current = new Date(start + 'T12:00:00')
  const endDate = new Date(end + 'T12:00:00')

  while (current <= endDate) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }

  return dates
}

export interface CatalogLookup {
  productos: PosProducto[]
  syncedAt: Date | null
  isFresh: boolean
}

export async function getCachedCatalogo(
  companyId: string,
  localId: number,
): Promise<CatalogLookup | null> {
  const ref = doc(db, 'companies', companyId, CATALOG_COLLECTION, String(localId))
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as { productos?: PosProducto[]; syncedAt?: Timestamp }
  const syncedAt = data.syncedAt?.toDate() ?? null
  const ageMs = syncedAt ? Date.now() - syncedAt.getTime() : Infinity
  return {
    productos: data.productos ?? [],
    syncedAt,
    isFresh: ageMs < CATALOG_TTL_MS,
  }
}

export async function saveCatalogoToCache(
  companyId: string,
  localId: number,
  productos: PosProducto[],
): Promise<void> {
  const ref = doc(db, 'companies', companyId, CATALOG_COLLECTION, String(localId))
  await setDoc(ref, {
    localId,
    productos,
    syncedAt: Timestamp.now(),
  })
}

export function getTodayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface CachedMonthStats {
  month: string // 'YYYY-MM'
  daysWithData: number // fechas únicas con al menos un local stampado
  daysExpected: number // días del mes (clamp al día actual si es el mes vigente)
  completeness: number // daysWithData / daysExpected
  lastSync: Date | null
  ventasTotal: number // Σ num(total) excluyendo anuladas, mismo filtro que /pos-sync
  ventasCount: number // # de comprobantes no anulados
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// Enumera los meses cacheados para una company leyendo
// `companies/{id}/pos-sales-cache-meta` + todos los docs de `pos-sales-cache`
// en una sola query. Calcula completeness del mes a partir de las fechas
// únicas presentes en el map `days` (keys `YYYY-MM-DD_localId`), y el total
// de ventas agrupando los docs por `date.slice(0,7)`. Excluye anuladas
// (`estado_txt === 'comprobante anulado'`) para cuadrar con el KPI que
// muestra la tab Ventas. Para el mes actual, `daysExpected` se recorta al
// día de hoy para no marcar 80% solo porque el mes aún no terminó.
export async function listCachedMonths(companyId: string): Promise<CachedMonthStats[]> {
  const metaRef = collection(db, 'companies', companyId, META_COLLECTION)
  const salesRef = collection(db, 'companies', companyId, SALES_COLLECTION)

  const [metaSnap, salesSnap] = await Promise.all([getDocs(metaRef), getDocs(salesRef)])

  const today = getTodayStr()
  const currentMonth = today.slice(0, 7)
  const todayDay = Number(today.slice(8, 10))

  // Totales por mes a partir de los docs de ventas (single-pass).
  interface MonthTotals { total: number; count: number }
  const totalsByMonth = new Map<string, MonthTotals>()
  for (const d of salesSnap.docs) {
    const data = d.data() as { date?: string; ventas?: Array<Record<string, unknown>> }
    const month = data.date?.slice(0, 7)
    if (!month) continue
    const bucket = totalsByMonth.get(month) ?? { total: 0, count: 0 }
    const list = data.ventas ?? []
    for (const v of list) {
      const estado = String((v as { estado_txt?: string }).estado_txt ?? '').toLowerCase()
      if (estado === 'comprobante anulado') continue
      bucket.total += Number((v as { total?: unknown }).total) || 0
      bucket.count += 1
    }
    totalsByMonth.set(month, bucket)
  }

  const stats: CachedMonthStats[] = []
  for (const d of metaSnap.docs) {
    const data = d.data() as MetaDoc
    const month = data.month ?? d.id
    if (!/^\d{4}-\d{2}$/.test(month)) continue

    const days = data.days ?? {}
    const uniqueDates = new Set<string>()
    let maxTs = 0
    for (const [key, ts] of Object.entries(days)) {
      const date = key.split('_')[0]
      if (date) uniqueDates.add(date)
      const ms = ts instanceof Timestamp ? ts.toMillis() : 0
      if (ms > maxTs) maxTs = ms
    }

    const monthDays = daysInMonth(month)
    const daysExpected = month === currentMonth ? Math.min(todayDay, monthDays) : monthDays
    const daysWithData = uniqueDates.size
    const completeness = daysExpected > 0 ? Math.min(daysWithData / daysExpected, 1) : 0
    const totals = totalsByMonth.get(month) ?? { total: 0, count: 0 }

    stats.push({
      month,
      daysWithData,
      daysExpected,
      completeness,
      lastSync: maxTs > 0 ? new Date(maxTs) : null,
      ventasTotal: totals.total,
      ventasCount: totals.count,
    })
  }

  stats.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
  return stats
}
