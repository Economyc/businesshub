import { useMemo } from 'react'
import { useDateRange } from '@/core/ui/date-range-context'
import { usePosVentas } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import {
  calcTotals,
  isAnulada,
  toDateStrLocal,
  type PosTotals,
} from '@/modules/pos-sync/utils/sales-calculations'

// ─── POS Analytics ───────────────────────────────────────────────────

export function usePosAnalytics(): {
  totals: PosTotals
  loading: boolean
  rateLimited: boolean
  hasLocales: boolean
  lastUpdated: Date | null
  fromCache: boolean
  forceRefresh: () => void
} {
  const { startDate, endDate } = useDateRange()
  const { localIds, loading: localesLoading } = useCompanyLocalIds()

  const startStr = toDateStrLocal(startDate)
  const endStr = toDateStrLocal(endDate)

  const {
    ventas,
    isPending: ventasPending,
    rateLimited,
    lastUpdated,
    fromCache,
    forceRefresh,
  } = usePosVentas({
    localIds,
    startDate: startStr,
    endDate: endStr,
    enabled: localIds.length > 0,
  })

  // Solo skeleton en primera carga sin data/placeholder. Mismo patrón que
  // Home (`posColdLoading`) y POS Sync (`showSkeleton = loading && !hasData`):
  // durante refetches/auto-refresh, React Query mantiene los datos previos
  // (keepPreviousData) y la UI sigue mostrando KPIs en vez de parpadear al
  // skeleton. Incluimos localesLoading para evitar el flash datos→skeleton→datos.
  const hasData = ventas.length > 0
  const coldLoading = localesLoading || (ventasPending && localIds.length > 0 && !hasData)

  const totals = useMemo(
    () => calcTotals(ventas.filter((v) => !isAnulada(v))),
    [ventas]
  )

  return {
    totals,
    loading: coldLoading,
    rateLimited,
    hasLocales: localIds.length > 0,
    lastUpdated,
    fromCache,
    forceRefresh,
  }
}
