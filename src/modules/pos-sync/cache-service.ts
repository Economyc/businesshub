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
// profunda de 32 días la hace un cron nocturno (functions/src/pos-reconcile.ts,
// 01:00 America/Bogota) que hidrata el mismo cache. El cliente solo necesita
// un margen pequeño para cubrir el caso donde el cron no corrió (empresa
// nueva, falla puntual del POS) — con 2 días recuperamos ayer/anteayer sin
// pagar los ~3 minutos que costaban los 32 días completos en cada carga.
// Si el cron falla varios días seguidos, el botón "Forzar sincronización"
// dispara `posReconcileOnDemand` para cubrir los 32.
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

export function isLikelyPartialResponse(newCount: number, prevCount: number): boolean {
  return prevCount > 0 && newCount < prevCount * PARTIAL_RESPONSE_THRESHOLD
}

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
  const batch = writeBatch(db)
  const now = Timestamp.now()

  const metaUpdates = new Map<string, Record<string, Timestamp>>()

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
      // Don't update the meta either, so the next load re-tries.
      if (isLikelyPartialResponse(newCount, prevCount)) {
        // eslint-disable-next-line no-console
        console.warn(
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
        // Paginar en chunks para no exceder el límite de 1 MiB por doc.
        const pages = Math.ceil(group.length / MAX_VENTAS_PER_DOC)
        for (let p = 0; p < pages; p++) {
          const chunk = group.slice(p * MAX_VENTAS_PER_DOC, (p + 1) * MAX_VENTAS_PER_DOC)
          const docId = `${key}_p${p}`
          const docRef = doc(db, 'companies', companyId, SALES_COLLECTION, docId)
          batch.set(docRef, {
            date,
            localId,
            page: p,
            pages,
            ventas: chunk,
            syncedAt: now,
          })
        }
      }
    }
  }

  for (const [month, days] of metaUpdates) {
    if (Object.keys(days).length === 0) continue
    const metaRef = doc(db, 'companies', companyId, META_COLLECTION, month)
    batch.set(metaRef, { month, days }, { merge: true })
  }

  await batch.commit()
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
