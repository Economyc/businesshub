import { useMemo, useState } from 'react'
import { RefreshCw, Loader2, Clock, MapPin, XCircle } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { formatCurrency } from '@/core/utils/format'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas } from '../hooks'
import { isAnulada, num, toDateStrLocal, ventaMonto } from '../utils/sales-calculations'
import { VentaDetailDrawer } from './venta-detail-drawer'
import type { PosVenta, PosLocal } from '../types'

const toDateStr = toDateStrLocal

interface AnuladasTabProps {
  localIds: number[]
  allLocalIds: number[]
  locales: PosLocal[]
  localLabel: string | null
}

export function AnuladasTab({ localIds, allLocalIds, locales, localLabel }: AnuladasTabProps) {
  const [selectedVenta, setSelectedVenta] = useState<PosVenta | null>(null)
  const { startDate, endDate } = useDateRange()
  const startDateStr = toDateStr(startDate)
  const endDateStr = toDateStr(endDate)
  const { ventas, loading, error, rateLimited, lastUpdated, fromCache, refetch, progress } = usePosVentas({
    localIds: allLocalIds,
    startDate: startDateStr,
    endDate: endDateStr,
    enabled: allLocalIds.length > 0,
  })

  function handleConsultar() {
    refetch()
  }

  const localNameMap = useMemo(() => {
    const map = new Map<number, string>()
    locales.forEach((l) => map.set(Number(l.local_id), l.local_descripcion))
    return map
  }, [locales])

  const anuladas = useMemo(() => {
    const localSet = new Set(localIds)
    return ventas.filter((v) => isAnulada(v) && localSet.has(v.id_local))
  }, [ventas, localIds])

  const total = useMemo(() => anuladas.reduce((sum, v) => sum + ventaMonto(v), 0), [anuladas])

  const columns: Column<PosVenta & { id: string }>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: '140px',
      render: (v) => <span className="text-body tabular-nums">{v.fecha?.slice(0, 16) ?? '—'}</span>,
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
          <span className="text-mid-gray tabular-nums">
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
        <span className="font-semibold text-dark-graphite tabular-nums">{formatCurrency(num(v.total))}</span>
      ),
    },
  ]

  function addId(list: PosVenta[]) {
    return list.map((v) => ({ ...v, id: v.ID ?? String(Math.random()) }))
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative bg-surface rounded-2xl card-elevated border border-bone/60 p-5 md:p-6 mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={14} className="text-mid-gray shrink-0" />
            <span className="text-caption uppercase tracking-wider text-mid-gray">Local</span>
            <span className="text-caption font-semibold text-dark-graphite truncate">
              {localLabel ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && (
              <span className="flex items-center gap-1 text-caption text-mid-gray tabular-nums">
                <Clock size={12} />
                {lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                {fromCache && <span className="ml-1">(cache)</span>}
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
        </div>

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-caption uppercase tracking-wider text-mid-gray mb-1">
              Documentos anulados
            </div>
            <div className="text-[44px] md:text-[52px] leading-none font-bold text-dark-graphite tabular-nums">
              {anuladas.length}
            </div>
          </div>
          <div className="text-right">
            <div className="text-caption text-mid-gray">Monto anulado</div>
            <div className="text-body font-semibold text-dark-graphite tabular-nums">
              {formatCurrency(total)}
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, var(--color-dark-graphite, #1a1a1a), transparent 70%)' }}
        />
      </div>

      {/* Rate limit warning */}
      {rateLimited && ventas.length > 0 && (
        <div className="bg-warning-bg text-warning-text rounded-xl px-4 py-3 text-body mb-4 flex items-center gap-2">
          <Clock size={16} className="shrink-0" />
          La API del POS está procesando otra solicitud. Mostrando última consulta disponible.
        </div>
      )}

      {error && (
        <div className="bg-negative-bg text-negative-text rounded-xl px-4 py-3 text-body mb-4">{error}</div>
      )}

      {!loading && anuladas.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-8 text-mid-gray">
          <XCircle size={24} className="opacity-50" />
          <span className="text-body">No hay comprobantes anulados en el rango seleccionado.</span>
        </div>
      )}

      {anuladas.length > 0 && (
        <DataTable columns={columns} data={addId(anuladas)} onRowClick={setSelectedVenta} />
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-mid-gray" />
          <span className="ml-2 text-body text-mid-gray">
            {progress
              ? `Sincronizando periodo ${progress.current} de ${progress.total}...`
              : 'Consultando ventas del POS...'}
          </span>
        </div>
      )}

      <VentaDetailDrawer venta={selectedVenta} onClose={() => setSelectedVenta(null)} />
    </div>
  )
}
