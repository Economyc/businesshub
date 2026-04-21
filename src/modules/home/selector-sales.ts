import { collection, query, where, getDocs } from 'firebase/firestore'
import { queryClient } from '@/core/query/query-client'
import { db } from '@/core/firebase/config'
import { companyCollection } from '@/core/firebase/helpers'
import { isAnulada, ventaMonto } from '@/modules/pos-sync/utils/sales-calculations'
import { findMatchingLocal } from '@/modules/pos-sync/company-mapping'
import { posService } from '@/modules/pos-sync/services'
import type { Company } from '@/core/types'
import type { Closing } from '@/modules/closings/types'
import type { PosVenta } from '@/modules/pos-sync/types'

export interface DaySales {
  today: number
  yesterday: number
}

export const SELECTOR_SALES_STALE_MS = 5 * 60 * 1000

export function ymd(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function selectorSalesKey(companyId: string, today: string) {
  return ['selector-sales', companyId, today] as const
}

async function fetchClosingSum(companyId: string, dateStr: string): Promise<number> {
  const ref = companyCollection(companyId, 'closings')
  const snap = await getDocs(query(ref, where('date', '==', dateStr)))
  return snap.docs.reduce((sum, d) => {
    const data = d.data() as Closing
    return sum + (typeof data.ventaTotal === 'number' ? data.ventaTotal : 0)
  }, 0)
}

function sumVentasByDate(
  ventas: PosVenta[],
  allowedIds: Set<number>,
  today: string,
  yesterday: string,
): DaySales {
  let todayTotal = 0
  let yTotal = 0
  for (const v of ventas) {
    if (!allowedIds.has(v.id_local)) continue
    if (isAnulada(v)) continue
    const date = v.fecha?.slice(0, 10)
    if (!date) continue
    const amount = ventaMonto(v)
    if (date === today) todayTotal += amount
    else if (date === yesterday) yTotal += amount
  }
  return { today: todayTotal, yesterday: yTotal }
}

// Lee ventas directamente del cache de Firestore (hidratado por el cron
// nocturno para ayer y por visitas previas al Home para hoy). Sin llamada POS.
async function readCacheTotals(
  companyId: string,
  allowedIds: Set<number>,
  today: string,
  yesterday: string,
): Promise<DaySales> {
  const ref = collection(db, 'companies', companyId, 'pos-sales-cache')
  const snap = await getDocs(
    query(ref, where('date', '>=', yesterday), where('date', '<=', today)),
  )
  const ventas: PosVenta[] = []
  for (const d of snap.docs) {
    const data = d.data() as { ventas?: PosVenta[] }
    if (data.ventas?.length) ventas.push(...data.ventas)
  }
  return sumVentasByDate(ventas, allowedIds, today, yesterday)
}

// Replica el pipeline del Home/POS Sync con 3 capas de fallback:
//   1) POS live (getVentasBatch) — datos al segundo, igual que Home
//   2) Cache Firestore (pos-sales-cache) — si el POS falla por rate-limit,
//      timeout o red, leemos los datos que el cron nocturno + visitas previas
//      al Home ya dejaron hidratados
//   3) Closings — última opción para compañías sin POS configurado
// Garantiza que el KPI del selector cuadre 1:1 con lo que muestra el Home
// al aplicar filtro "Hoy", y que compañías con POS nunca colapsen a $0 por
// un fallo transitorio de red.
export async function fetchCompanySales(
  company: Company,
  today: string,
  yesterday: string,
): Promise<DaySales> {
  try {
    const dominio = await posService.getDominio(company.id)
    const locales = dominio?.locales ?? []
    if (locales.length === 0) throw new Error('sin locales')

    const matched = findMatchingLocal(locales, company)
    const localIds = matched
      ? [Number(matched.local_id)]
      : locales.map((l) => Number(l.local_id))
    const allowedIds = new Set(localIds)

    try {
      const result = await posService.getVentasBatch(
        company.id,
        localIds,
        `${yesterday} 00:00:00`,
        `${today} 23:59:59`,
      )
      return sumVentasByDate(result.ventas, allowedIds, today, yesterday)
    } catch {
      return readCacheTotals(company.id, allowedIds, today, yesterday)
    }
  } catch {
    const [t, y] = await Promise.all([
      fetchClosingSum(company.id, today),
      fetchClosingSum(company.id, yesterday),
    ])
    return { today: t, yesterday: y }
  }
}

// Idempotente: si ya hay data fresca dentro de SELECTOR_SALES_STALE_MS,
// React Query no redispara fetch. Seguro de llamar en onMouseEnter y post-login.
const prefetchedAt = new Map<string, number>()

export function prefetchSelectorSales(companies: Company[]): void {
  if (companies.length === 0) return
  const today = ymd(0)
  const yesterday = ymd(-1)
  const now = Date.now()
  for (const c of companies) {
    const key = `${c.id}_${today}`
    const last = prefetchedAt.get(key) ?? 0
    if (now - last < SELECTOR_SALES_STALE_MS) continue
    prefetchedAt.set(key, now)
    queryClient.prefetchQuery({
      queryKey: selectorSalesKey(c.id, today),
      queryFn: () => fetchCompanySales(c, today, yesterday),
      staleTime: SELECTOR_SALES_STALE_MS,
    })
  }
}
