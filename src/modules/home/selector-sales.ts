import { collection, query, where, getDocs } from 'firebase/firestore'
import { queryClient } from '@/core/query/query-client'
import { db } from '@/core/firebase/config'
import { companyCollection } from '@/core/firebase/helpers'
import { isAnulada, ventaMonto } from '@/modules/pos-sync/utils/sales-calculations'
import { findMatchingLocal } from '@/modules/pos-sync/company-mapping'
import { posService } from '@/modules/pos-sync/services'
import type { Company } from '@/core/types'
import type { Closing } from '@/modules/closings/types'
import type { PosVenta, PosLocal } from '@/modules/pos-sync/types'

export interface DaySales {
  today: number
  yesterday: number
}

export type SelectorSalesMap = Record<string, DaySales>

export const SELECTOR_SALES_STALE_MS = 5 * 60 * 1000
const DOMINIO_STALE_MS = 60 * 60 * 1000 // 1h — los locales del tenant casi nunca cambian

export function ymd(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function selectorSalesKey(companyIds: string[], today: string) {
  const sorted = [...companyIds].sort().join(',')
  return ['selector-sales-all', sorted, today] as const
}

function tenantDominioKey(tenantId: string) {
  return ['tenant-dominio', tenantId] as const
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

// getDominio por tenant, cacheado en queryClient. El dominio cambia muy rara
// vez (solo si se crea/quita un local), así que 1h de staleTime es seguro y
// evita repetir el roundtrip al POS en cada entrada al selector.
async function getTenantLocales(
  tenantId: string,
  pivotCompanyId: string,
): Promise<PosLocal[]> {
  return queryClient.fetchQuery({
    queryKey: tenantDominioKey(tenantId),
    queryFn: async () => {
      const dominio = await posService.getDominio(pivotCompanyId)
      return dominio?.locales ?? []
    },
    staleTime: DOMINIO_STALE_MS,
  })
}

function computeAllowedIds(locales: PosLocal[], company: Company): Set<number> {
  if (locales.length === 0) return new Set()
  const matched = findMatchingLocal(locales, company)
  const ids = matched
    ? [Number(matched.local_id)]
    : locales.map((l) => Number(l.local_id))
  return new Set(ids)
}

// ESTRATEGIA CACHE-FIRST:
// El selector lee exclusivamente del cache Firestore `pos-sales-cache`, que
// hidratan (a) el cron nocturno con los días cerrados y (b) las visitas al
// Home con "hoy". Paralelo, sin rate-limit, sin llamadas POS lentas.
//
// Trade-off: "hoy" puede estar desfasado ~30-60 min si nadie visitó el Home.
// Para el caso "ventas hoy" del selector, es aceptable. El Home sigue siendo
// la fuente real-time. Si el cache está vacío para hoy, la tarjeta muestra 0
// y eso fuerza al user a entrar al Home, que al cargar hidrata el cache.
//
// Con este cambio: 1 getDominio paralelo por tenant (~500ms, cacheable 1h)
// + N reads Firestore paralelos (~200ms). Total <1s aun en frío.
export async function fetchAllCompaniesSales(
  companies: Company[],
  today: string,
  yesterday: string,
): Promise<SelectorSalesMap> {
  const result: SelectorSalesMap = {}
  for (const c of companies) result[c.id] = { today: 0, yesterday: 0 }

  // Agrupar por tenant para resolver dominios una vez cada uno
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

  // 1) getDominio por tenant, en paralelo. Best-effort: si falla, las
  //    compañías de ese tenant se quedan en 0 (closings sería overkill aquí).
  const tenantLocales = new Map<string, PosLocal[]>()
  await Promise.all(
    [...byTenant.entries()].map(async ([tid, comps]) => {
      try {
        const locales = await getTenantLocales(tid, comps[0].id)
        tenantLocales.set(tid, locales)
      } catch {
        tenantLocales.set(tid, [])
      }
    }),
  )

  // 2) Reads de cache Firestore + closings, todo en paralelo
  await Promise.all([
    ...companies
      .filter((c) => c.posTenantId)
      .map(async (c) => {
        const locales = tenantLocales.get(c.posTenantId!) ?? []
        const allowed = computeAllowedIds(locales, c)
        if (allowed.size === 0) return
        try {
          result[c.id] = await readCacheTotals(c.id, allowed, today, yesterday)
        } catch {
          // cache read falló → dejar en 0
        }
      }),
    ...noTenant.map(async (c) => {
      try {
        result[c.id] = await fetchClosingsDaySales(c.id, today, yesterday)
      } catch {
        // closings falló → dejar en 0
      }
    }),
  ])

  return result
}

// Idempotente. Llamable post-login (useEffect en CompanyProvider) y on-hover
// (sidebar "Mis compañías") para tener data lista al aterrizar en el selector.
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
