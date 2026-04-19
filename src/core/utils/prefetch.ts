import { queryClient } from '@/core/query/query-client'
import { fetchCollection } from '@/core/firebase/helpers'

const moduleImports = [
  () => import('@/modules/home/components/home-page'),
  () => import('@/modules/analytics/components/general-dashboard'),
  () => import('@/modules/talent/components/employee-list'),
  () => import('@/modules/talent/components/employee-profile'),
  () => import('@/modules/suppliers/components/supplier-list'),
  () => import('@/modules/suppliers/components/supplier-detail'),
  () => import('@/modules/finance/components/transaction-list'),
  () => import('@/modules/finance/components/transaction-form'),
  () => import('@/modules/finance/components/import-view'),
  () => import('@/modules/finance/components/cash-flow-view'),
  () => import('@/modules/finance/components/income-statement-view'),
  () => import('@/modules/finance/components/budget-view'),
  () => import('@/modules/partners/components/partner-list'),
  () => import('@/core/ui/settings-companies'),
  () => import('@/core/ui/settings-categories'),
  () => import('@/core/ui/settings-roles'),
  () => import('@/core/ui/settings-departments'),
]

export function prefetchRoutes() {
  const run = () => {
    Promise.all(moduleImports.map((fn) => fn().catch(() => {})))
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(run)
  } else {
    setTimeout(run, 200)
  }
}

// Colecciones que HomePage consume al montarse a través de useCollection<T>(name).
// queryKey espejo exacto de src/core/hooks/use-firestore.ts → ['firestore', companyId, name].
// queryFn idéntica a la del hook, sin constraints (igual que useCollection sin args).
const HOME_COLLECTIONS = ['transactions', 'closings', 'payments', 'suppliers', 'contracts', 'purchases'] as const

export function prefetchHomeData(companyId: string) {
  if (!companyId) return
  for (const name of HOME_COLLECTIONS) {
    queryClient.prefetchQuery({
      queryKey: ['firestore', companyId, name],
      queryFn: () => fetchCollection(companyId, name),
    })
  }
}
