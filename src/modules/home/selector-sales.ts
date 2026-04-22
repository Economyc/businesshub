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

export type SelectorSalesMap = Record<string, DaySales>

export const SELECTOR_SALES_STALE_MS = 5 * 60 * 1000

export function ymd(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function selectorSalesKey(companyIds: string[], today: string) {
  const sorted = [...companyIds].sort().join(',')
  return ['selector-sales-all', sorted, today] as const
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

async function fetchClosingsDaySales(
  companyId: string,
  today: string,
  yesterday: string,
): Promise<DaySales> {
  const [t, y] = await Promise.all([
    fetchClosingSum(companyId, today),
    fetchClosingSum(companyId, yesterday),
  ])
  return { today: t, yesterday: y }
}

// Procesa todas las companies de un mismo tenant POS en UNA llamada batch.
// Antes: N companies → N llamadas POS paralelas compartiendo el mismo token,
// una chocaba contra el rate-limit ("solicitud en ejecución") y caía a cache
// vacío mostrando $0. Ahora: 1 getDominio + 1 getVentasBatch con todos los
// localIds del tenant, y repartimos los resultados por company según el match.
async function fetchTenantSales(
  tenantCompanies: Company[],
  today: string,
  yesterday: string,
): Promise<Map<string, DaySales>> {
  const out = new Map<string, DaySales>()
  const pivot = tenantCompanies[0]

  let locales: Awaited<ReturnType<typeof posService.getDominio>>['locales'] | null = null
  try {
    const dominio = await posService.getDominio(pivot.id)
    locales = dominio?.locales ?? []
  } catch {
    locales = null
  }

  if (!locales || locales.length === 0) {
    // Sin dominio → closings por compañía
    await Promise.all(
      tenantCompanies.map(async (c) => {
        out.set(c.id, await fetchClosingsDaySales(c.id, today, yesterday))
      }),
    )
    return out
  }

  // Mapeo company → localIds permitidos
  const companyLocals = new Map<string, Set<number>>()
  const allLocalIds = new Set<number>()
  for (const c of tenantCompanies) {
    const matched = findMatchingLocal(locales, c)
    const ids = matched
      ? [Number(matched.local_id)]
      : locales.map((l) => Number(l.local_id))
    companyLocals.set(c.id, new Set(ids))
    for (const id of ids) allLocalIds.add(id)
  }

  try {
    const res = await posService.getVentasBatch(
      pivot.id,
      [...allLocalIds],
      `${yesterday} 00:00:00`,
      `${today} 23:59:59`,
    )
    for (const c of tenantCompanies) {
      const allowed = companyLocals.get(c.id)!
      out.set(c.id, sumVentasByDate(res.ventas, allowed, today, yesterday))
    }
  } catch {
    // POS falló para el tenant entero → cache Firestore por compañía en paralelo
    await Promise.all(
      tenantCompanies.map(async (c) => {
        const allowed = companyLocals.get(c.id)!
        out.set(c.id, await readCacheTotals(c.id, allowed, today, yesterday))
      }),
    )
  }

  return out
}

// Una sola función, una sola query, una sola revelación en UI.
// Agrupa por posTenantId para que cada tenant haga exactamente 1 llamada POS
// (con todos sus locales). Companies sin tenant caen a closings.
export async function fetchAllCompaniesSales(
  companies: Company[],
  today: string,
  yesterday: string,
): Promise<SelectorSalesMap> {
  const result: SelectorSalesMap = {}
  for (const c of companies) result[c.id] = { today: 0, yesterday: 0 }

  const byTenant = new Map<string, Company[]>()
  const noTenant: Company[] = []
  for (const c of companies) {
    if (c.posTenantId) {
      const list = byTenant.get(c.posTenantId) ?? []
      list.push(c)
      byTenant.set(c.posTenantId, list)
    } else {
      noTenant.push(c)
    }
  }

  const tenantJobs = [...byTenant.values()].map(async (group) => {
    const map = await fetchTenantSales(group, today, yesterday)
    for (const [id, sales] of map) result[id] = sales
  })
  const closingJobs = noTenant.map(async (c) => {
    result[c.id] = await fetchClosingsDaySales(c.id, today, yesterday)
  })

  await Promise.all([...tenantJobs, ...closingJobs])
  return result
}

// Idempotente: si ya hay data fresca dentro de SELECTOR_SALES_STALE_MS,
// React Query no redispara fetch. Seguro de llamar en onMouseEnter y post-login.
const prefetchedAt = new Map<string, number>()

export function prefetchSelectorSales(companies: Company[]): void {
  if (companies.length === 0) return
  const today = ymd(0)
  const yesterday = ymd(-1)
  const ids = companies.map((c) => c.id)
  const key = `${[...ids].sort().join(',')}_${today}`
  const now = Date.now()
  const last = prefetchedAt.get(key) ?? 0
  if (now - last < SELECTOR_SALES_STALE_MS) return
  prefetchedAt.set(key, now)
  queryClient.prefetchQuery({
    queryKey: selectorSalesKey(ids, today),
    queryFn: () => fetchAllCompaniesSales(companies, today, yesterday),
    staleTime: SELECTOR_SALES_STALE_MS,
  })
}
