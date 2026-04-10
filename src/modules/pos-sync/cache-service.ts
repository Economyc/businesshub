import { db } from '@/core/firebase/config'
import { collection, query, where, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore'
import type { PosVenta } from './types'

const COLLECTION = 'pos-sales-cache'

interface CachedDateEntry {
  date: string
  localId: number
  ventas: PosVenta[]
  syncedAt: Timestamp
}

/**
 * Get cached ventas for a date range from Firestore.
 */
export async function getCachedVentas(
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<CachedDateEntry[]> {
  const ref = collection(db, 'companies', companyId, COLLECTION)
  const q = query(ref, where('date', '>=', startDate), where('date', '<=', endDate))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as CachedDateEntry)
}

/**
 * Save ventas to Firestore cache, grouped by date + local.
 */
export async function saveVentasToCache(
  companyId: string,
  ventas: PosVenta[],
  localIds: number[],
  startDate: string,
  endDate: string,
): Promise<void> {
  // Group ventas by date + localId
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

  for (const date of allDates) {
    for (const localId of localIds) {
      const key = `${date}_${localId}`
      const docRef = doc(db, 'companies', companyId, COLLECTION, key)
      batch.set(docRef, {
        date,
        localId,
        ventas: groups.get(key) ?? [],
        syncedAt: now,
      })
    }
  }

  await batch.commit()
}

/**
 * Enumerate all dates between start and end (inclusive). YYYY-MM-DD format.
 */
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

/**
 * Get today's date as YYYY-MM-DD.
 */
export function getTodayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
