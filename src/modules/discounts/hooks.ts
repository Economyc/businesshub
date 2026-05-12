import { useMemo } from 'react'
import { useCollection } from '@/core/hooks/use-firestore'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import { calcTotals, isAnulada, toDateStrLocal } from '@/modules/pos-sync/utils/sales-calculations'
import type { Discount } from './types'

export function useDiscounts() {
  return useCollection<Discount>('discounts')
}

export function usePosDiscountsTotal(): {
  total: number
  loading: boolean
  hasLocales: boolean
  rateLimited: boolean
} {
  const { startDate, endDate } = useDateRange()
  const { localIds, loading: localesLoading } = useCompanyLocalIds()

  const { ventas, isPending: ventasPending, rateLimited } = usePosVentas({
    localIds,
    startDate: toDateStrLocal(startDate),
    endDate: toDateStrLocal(endDate),
    enabled: localIds.length > 0,
  })

  const hasData = ventas.length > 0
  const coldLoading = localesLoading || (ventasPending && localIds.length > 0 && !hasData)

  const total = useMemo(() => {
    const valid = ventas.filter((v) => !isAnulada(v))
    return Math.abs(calcTotals(valid).descuento)
  }, [ventas])

  return {
    total,
    loading: coldLoading,
    hasLocales: localIds.length > 0,
    rateLimited,
  }
}
