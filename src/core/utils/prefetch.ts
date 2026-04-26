import { queryClient } from '@/core/query/query-client'
import { fetchCollection } from '@/core/firebase/helpers'

// Chunks lazy por ruta. Cada función es el mismo `import()` que React.lazy
// dispara al montar la página; llamarlo antes (en hover) empieza la descarga
// del chunk en background. Llamadas repetidas son idempotentes — Vite/webpack
// deduplica.
const CHUNK_BY_PATH: Record<string, () => Promise<unknown>> = {
  '/home': () => import('@/modules/home/components/home-page'),
  '/agent': () => import('@/modules/agent/components/agent-page'),
  '/analytics': () => import('@/modules/analytics/components/general-dashboard'),
  '/analytics/pos': () => import('@/modules/analytics/components/pos-dashboard'),
  '/analytics/costs': () => import('@/modules/analytics/components/costs-dashboard'),
  '/analytics/purchases': () => import('@/modules/analytics/components/purchases-dashboard'),
  '/analytics/payroll': () => import('@/modules/analytics/components/payroll-dashboard'),
  '/finance': () => import('@/modules/finance/components/transaction-list'),
  '/finance/cash-flow': () => import('@/modules/finance/components/cash-flow-view'),
  '/finance/income-statement': () => import('@/modules/finance/components/income-statement-view'),
  '/finance/budget': () => import('@/modules/finance/components/budget-view'),
  '/finance/reconciliation': () => import('@/modules/finance/components/reconciliation-view'),
  '/finance/purchases': () => import('@/modules/purchases/components/purchase-list'),
  '/finance/purchases/products': () => import('@/modules/purchases/components/product-list'),
  '/cartera': () => import('@/modules/cartera/components/cartera-dashboard'),
  '/closings': () => import('@/modules/closings/components/closing-list'),
  '/payroll': () => import('@/modules/payroll/components/payroll-list'),
  '/prestaciones': () => import('@/modules/prestaciones/components/settlement-list'),
  '/contracts': () => import('@/modules/contracts/components/contract-list'),
  '/partners': () => import('@/modules/partners/components/partner-list'),
  '/talent': () => import('@/modules/talent/components/employee-list'),
  '/suppliers': () => import('@/modules/suppliers/components/supplier-list'),
  '/marketing/influencers': () => import('@/modules/marketing/influencers/components/influencer-list'),
  '/pos-sync': () => import('@/modules/pos-sync/components/pos-sync-page'),
  '/settings/companies': () => import('@/core/ui/settings-companies'),
  '/settings/categories': () => import('@/core/ui/settings-categories'),
  '/settings/roles': () => import('@/core/ui/settings-roles'),
  '/settings/departments': () => import('@/core/ui/settings-departments'),
  '/settings/team': () => import('@/core/ui/settings-team'),
}

// Colecciones Firestore principales que cada ruta consume vía `useCollection`.
// queryKey espejo exacto de src/core/hooks/use-firestore.ts → ['firestore', companyId, name].
//
// REGLA: solo prefetchear catálogos LIVIANOS (suppliers, contracts, employees,
// products, partners, closings, contract_templates). Las colecciones que
// crecen sin tope con el tiempo (transactions, purchases, payments) NO se
// prefetchean — saturaban la red al hover/login con canales de varios MB
// que dejaban a las queries reales del módulo compitiendo por ancho de banda.
// Esas colecciones se cargan on-demand cuando el módulo monta, y persistence
// + staleTime 5min hacen que la 2da visita sea instantánea.
const COLLECTIONS_BY_PATH: Record<string, readonly string[]> = {
  '/home': ['closings', 'suppliers', 'contracts'],
  '/analytics/payroll': ['employees'],
  '/finance/reconciliation': ['bank-statements'],
  '/finance/purchases/products': ['products'],
  '/closings': ['closings'],
  '/payroll': ['payrolls', 'employees'],
  '/prestaciones': ['settlements', 'employees'],
  '/contracts': ['contracts', 'contract_templates'],
  '/partners': ['partners'],
  '/talent': ['employees'],
  '/suppliers': ['suppliers'],
  '/marketing/influencers': ['influencer-visits'],
}

// Evitar re-disparar el prefetch del mismo path muchas veces por sesión
// (hovers repetidos sobre el mismo link). El dedup de React Query ya lo hace
// por staleTime, pero con este set evitamos incluso el overhead de crear
// prefetchQuery.
const prefetchedPaths = new Set<string>()

export function prefetchRoute(path: string, companyId: string | undefined): void {
  // Para rutas con params o que no están en el mapa (ej. /contracts/:id),
  // buscamos el match más largo. Ej. `/finance/purchases/new` → `/finance/purchases`.
  const resolved = resolvePath(path)
  if (!resolved) return
  const key = `${companyId ?? 'nocompany'}_${resolved}`
  if (prefetchedPaths.has(key)) return
  prefetchedPaths.add(key)

  const chunkLoader = CHUNK_BY_PATH[resolved]
  if (chunkLoader) chunkLoader().catch(() => { /* swallow */ })

  if (!companyId) return
  const collections = COLLECTIONS_BY_PATH[resolved]
  if (!collections) return
  for (const name of collections) {
    queryClient.prefetchQuery({
      queryKey: ['firestore', companyId, name],
      queryFn: () => fetchCollection(companyId, name),
    })
  }
}

function resolvePath(path: string): string | null {
  if (CHUNK_BY_PATH[path] || COLLECTIONS_BY_PATH[path]) return path
  // Match más específico primero: ordenar por longitud desc y buscar prefix.
  const keys = Object.keys(CHUNK_BY_PATH).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (path.startsWith(k + '/') || path === k) return k
  }
  return null
}

// Reset del cache de prefetch cuando cambia la company (las colecciones cachean
// por companyId, pero limpiamos el set interno para permitir el prefetch
// de la nueva company en el próximo hover).
export function resetPrefetchCache(): void {
  prefetchedPaths.clear()
}

// Colecciones que HomePage consume al montarse y que vale la pena precalentar.
// Solo catálogos chicos: suppliers, contracts, closings. transactions/purchases/
// payments se EXCLUYEN — son las grandes y saturaban la red en background.
// Se cargan on-demand al montar el módulo, persistence + staleTime cubren las
// visitas siguientes.
const HOME_COLLECTIONS = ['closings', 'suppliers', 'contracts'] as const

export function prefetchHomeData(companyId: string) {
  if (!companyId) return
  for (const name of HOME_COLLECTIONS) {
    queryClient.prefetchQuery({
      queryKey: ['firestore', companyId, name],
      queryFn: () => fetchCollection(companyId, name),
    })
  }
}
