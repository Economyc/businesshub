import { useMemo, useEffect, useState } from 'react'
import { RefreshCw, Loader2, Clock } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { formatCurrency } from '@/core/utils/format'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas, useAutoRefresh } from '../hooks'
import { VentaDetailDrawer } from './venta-detail-drawer'
import type { PosVenta, PosLocal } from '../types'

function num(val: string | number | undefined): number {
  return Number(val) || 0
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface AnuladasTabProps {
  localIds: number[]
  allLocalIds: number[]
  locales: PosLocal[]
}

export function AnuladasTab({ localIds, allLocalIds, locales }: AnuladasTabProps) {
  const [selectedVenta, setSelectedVenta] = useState<PosVenta | null>(null)
  const { startDate, endDate } = useDateRange()
  const { ventas, loading, error, rateLimited, lastUpdated, fromCache, fetch } = usePosVentas()

  function handleConsultar() {
    fetch(allLocalIds, `${toDateStr(startDate)} 00:00:00`, `${toDateStr(endDate)} 23:59:59`)
  }

  // Auto-fetch on mount and when date range changes
  useEffect(() => {
    if (allLocalIds.length > 0) {
      fetch(allLocalIds, `${toDateStr(startDate)} 00:00:00`, `${toDateStr(endDate)} 23:59:59`)
    }
  }, [allLocalIds.length, startDate, endDate])

  useAutoRefresh(handleConsultar, 5 * 60 * 1000, allLocalIds.length > 0 && !loading)

  const localNameMap = useMemo(() => {
    const map = new Map<number, string>()
    locales.forEach((l) => map.set(Number(l.local_id), l.local_descripcion))
    return map
  }, [locales])

  const anuladas = useMemo(() => {
    const localSet = new Set(localIds)
    return ventas.filter(
      (v) =>
        v.estado_txt?.toLowerCase() === 'comprobante anulado' &&
        localSet.has(v.id_local)
    )
  }, [ventas, localIds])

  const total = useMemo(() => anuladas.reduce((sum, v) => sum + num(v.total), 0), [anuladas])

  const columns: Column<PosVenta & { id: string }>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: '140px',
      render: (v) => <span className="text-body">{v.fecha?.slice(0, 16) ?? '—'}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: '100px',
      hideOnMobile: true,
      render: (v) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
          {v.tipo_documento}
        </span>
      ),
    },
    {
      key: 'comprobante',
      header: 'Comprobante',
      width: '160px',
      hideOnMobile: true,
      render: (v) => (
        <span className="text-body">
          {v.documento}{' '}
          <span className="text-mid-gray">
            {v.serie}-{v.correlativo}
          </span>
        </span>
      ),
    },
    {
      key: 'local',
      header: 'Local',
      width: '140px',
      hideOnMobile: true,
      render: (v) => (
        <span className="text-body">{localNameMap.get(v.id_local) ?? `Local ${v.id_local}`}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      width: '120px',
      primary: true,
      render: (v) => (
        <span className="font-semibold text-dark-graphite">{formatCurrency(num(v.total))}</span>
      ),
    },
  ]

  function addId(list: PosVenta[]) {
    return list.map((v) => ({ ...v, id: v.ID ?? String(Math.random()) }))
  }

  return (
    <div>
      {/* Rate limit warning */}
      {rateLimited && ventas.length > 0 && (
        <div className="bg-warning-bg text-warning-text rounded-lg px-4 py-3 text-body mb-4 flex items-center gap-2">
          <Clock size={16} className="shrink-0" />
          La API del POS está procesando otra solicitud. Mostrando última consulta disponible.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-body mb-4">{error}</div>
      )}

      {!loading && anuladas.length === 0 && !error && (
        <div className="text-body text-mid-gray py-8 text-center">
          No hay comprobantes anulados en el rango seleccionado.
        </div>
      )}

      {anuladas.length > 0 && (
        <>
          {/* Summary line */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-body text-dark-graphite font-medium">
              {anuladas.length} documentos anulados · {formatCurrency(total)}
            </span>
            {lastUpdated && (
              <span className="flex items-center gap-1 text-caption text-mid-gray ml-auto">
                <Clock size={12} />
                {lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                {fromCache && ' (cache)'}
              </span>
            )}
            <button
              onClick={handleConsultar}
              disabled={loading}
              className="flex items-center gap-1 text-caption text-mid-gray hover:text-dark-graphite transition-colors disabled:opacity-50"
              aria-label="Actualizar anuladas"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Actualizar
            </button>
          </div>

          <DataTable columns={columns} data={addId(anuladas)} onRowClick={setSelectedVenta} />
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-mid-gray" />
          <span className="ml-2 text-body text-mid-gray">Consultando ventas del POS...</span>
        </div>
      )}

      <VentaDetailDrawer venta={selectedVenta} onClose={() => setSelectedVenta(null)} />
    </div>
  )
}
