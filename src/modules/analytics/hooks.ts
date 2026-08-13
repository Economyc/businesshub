import { useMemo } from 'react'
import { useDateRange } from '@/core/ui/date-range-context'
import { usePosVentas } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import {
  calcDocCounts,
  calcTotals,
  isAnulada,
  toDateStrLocal,
  type DocCounts,
  type PosTotals,
} from '@/modules/pos-sync/utils/sales-calculations'

// ─── POS Analytics ───────────────────────────────────────────────────

export function usePosAnalytics(): {
  totals: PosTotals
  docCounts: DocCounts
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

  // Una sola lista filtrada para ambos cálculos: los montos y el conteo por
  // tipo de comprobante tienen que medir exactamente el mismo conjunto.
  const ventasValidas = useMemo(() => ventas.filter((v) => !isAnulada(v)), [ventas])
  const totals = useMemo(() => calcTotals(ventasValidas), [ventasValidas])
  const docCounts = useMemo(() => calcDocCounts(ventasValidas), [ventasValidas])

  return {
    totals,
    docCounts,
    loading: coldLoading,
    rateLimited,
    hasLocales: localIds.length > 0,
    lastUpdated,
    fromCache,
    forceRefresh,
  }
}
