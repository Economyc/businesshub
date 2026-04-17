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

export const RECONCILE_WINDOW_DAYS = 7
export const RECONCILE_TTL_MS = 24 * 60 * 60 * 1000
export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000

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
  const now = Date.now()

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
    for (const [key, ts] of Object.entries(metaData.days ?? {})) {
      const date = key.split('_')[0]
      if (!date || date < startDate || date > endDate) continue
      const withinReconcile = date >= reconcileFrom && date < today
      const tsMs = ts?.toMillis?.() ?? 0
      // A day is stale if:
      //  - it's within the reconcile window AND its cache age exceeds the TTL, OR
      //  - it was cached before the day actually ended (cache snapshot taken mid-day,
      //    so afternoon/evening sales may be missing).
      const endOfDayMs = new Date(date + 'T23:59:59.999').getTime()
      const cachedMidDay = tsMs > 0 && tsMs < endOfDayMs
      const stale =
        withinReconcile && (now - tsMs > RECONCILE_TTL_MS || cachedMidDay)
      if (stale) staleKeys.add(key)
      else freshKeys.add(key)
    }
  }

  return { ventas, freshKeys, staleKeys }
}

export async function saveVentasToCache(
  companyId: string,
  ventas: PosVenta[],
  localIds: number[],
  startDate: string,
  endDate: string,
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
      monthPayload[key] = now
      const group = groups.get(key)
      if (group && group.length > 0) {
        const docRef = doc(db, 'companies', companyId, SALES_COLLECTION, key)
        batch.set(docRef, {
          date,
          localId,
          ventas: group,
          syncedAt: now,
        })
      }
    }
  }

  for (const [month, days] of metaUpdates) {
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
