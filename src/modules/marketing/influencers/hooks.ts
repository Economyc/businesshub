import { useState, useCallback } from 'react'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy } from 'firebase/firestore'
import { useCompany } from '@/core/hooks/use-company'
import { getCachedVentas } from '@/modules/pos-sync/cache-service'
import type { InfluencerVisit } from './types'

export function usePaginatedInfluencerVisits() {
  return usePaginatedCollection<InfluencerVisit>('influencer-visits', 50, orderBy('visitDate', 'desc'))
}

export interface PosOrderOption {
  ID: string
  documento: string
  serie: string
  correlativo: string
  total: number
  fecha: string
  items: string[]
}

export function usePosOrderSearch() {
  const { selectedCompany } = useCompany()
  const [orders, setOrders] = useState<PosOrderOption[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (dateStr: string) => {
    if (!selectedCompany || !dateStr) {
      setOrders([])
      return
    }
    setLoading(true)
    try {
      const cached = await getCachedVentas(selectedCompany.id, dateStr, dateStr)
      const allVentas = cached.flatMap((entry) => entry.ventas)
      const valid = allVentas.filter(
        (v) => v.estado_txt?.toLowerCase() !== 'comprobante anulado',
      )
      setOrders(
        valid.map((v) => ({
          ID: v.ID,
          documento: v.documento,
          serie: v.serie,
          correlativo: v.correlativo,
          total: Number(v.total),
          fecha: v.fecha,
          items: v.detalle?.map((d) => d.nombre_producto) ?? [],
        })),
      )
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [selectedCompany])

  return { orders, loading, search }
}
