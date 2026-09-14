import { useCallback, useMemo } from 'react'
import { useDateRange } from '@/core/ui/date-range-context'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import { usePosVentas } from '@/modules/pos-sync/hooks'
import type { ReportContext } from '../domain/builders'
import { toDeliveryOrders } from '../domain/delivery-orders'
import { previousPeriod, toYmd } from '../domain/period'

/**
 * Pedidos a domicilio del periodo elegido y del anterior (para la variación).
 * Usa el mismo `usePosVentas` que POS Sync → Ventas, así las cifras cuadran con
 * sus tarjetas por canal. El periodo anterior arranca cuando el actual ya cargó,
 * para no duplicar las llamadas al POS en paralelo.
 */
export function useDeliveryReportData() {
  const { startDate, endDate } = useDateRange()
  const period = useMemo(() => ({ start: toYmd(startDate), end: toYmd(endDate) }), [startDate, endDate])
  const previous = useMemo(() => previousPeriod(period), [period])

  const { localIds, loading: localsLoading, error: localsError } = useCompanyLocalIds()
  const hasLocals = localIds.length > 0

  const current = usePosVentas({
    localIds,
    startDate: period.start,
    endDate: period.end,
    enabled: hasLocals,
  })
  const prior = usePosVentas({
    localIds,
    startDate: previous.start,
    endDate: previous.end,
    enabled: hasLocals && !current.isPending,
  })

  const orders = useMemo(() => toDeliveryOrders(current.ventas, localIds), [current.ventas, localIds])
  const previousOrders = useMemo(() => toDeliveryOrders(prior.ventas, localIds), [prior.ventas, localIds])

  const context = useMemo<ReportContext>(
    () => ({ orders, previousOrders, period, previousPeriod: previous }),
    [orders, previousOrders, period, previous],
  )

  const { refetch: refetchCurrent } = current
  const { refetch: refetchPrior } = prior
  const refetch = useCallback(() => {
    // Si lo que falló fue la consulta de locales, usePosLocales no expone refetch:
    // recargar es la única forma de reintentarla.
    if (!hasLocals) {
      window.location.reload()
      return
    }
    void refetchCurrent()
    void refetchPrior()
  }, [hasLocals, refetchCurrent, refetchPrior])

  // Listo para descargar: datos reales de ESTE periodo (no el placeholder del
  // periodo anterior que React Query muestra mientras cambia el rango).
  const ready =
    hasLocals && !current.isPending && !current.isPlaceholderData && !prior.isPending && !prior.isPlaceholderData

  return {
    context,
    period,
    previousPeriod: previous,
    hasLocals,
    localsLoading,
    /** Primera carga del periodo actual, sin nada que mostrar todavía. */
    isPending: localsLoading || (hasLocals && current.isPending),
    /** El periodo anterior aún no llegó: las columnas de comparación no son reales. */
    previousPending: hasLocals && (prior.isPending || prior.isPlaceholderData),
    loading: current.loading || prior.loading,
    ready,
    error: localsError ?? current.error ?? prior.error,
    rateLimited: current.rateLimited || prior.rateLimited,
    progress: current.progress ?? prior.progress,
    refetch,
  }
}

export type DeliveryReportData = ReturnType<typeof useDeliveryReportData>
