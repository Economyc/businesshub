import { useMemo } from 'react'
import { Search, Loader2, MapPin } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas } from '../hooks'
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

interface VentasTabProps {
  localIds: number[]
  locales: PosLocal[]
}

export function VentasTab({ localIds, locales }: VentasTabProps) {
  const { startDate, endDate } = useDateRange()
  const { ventas, loading, error, fetch } = usePosVentas()
  const isMultiLocal = localIds.length > 1

  function handleConsultar() {
    fetch(localIds, `${toDateStr(startDate)} 00:00:00`, `${toDateStr(endDate)} 23:59:59`)
  }

  const localNameMap = useMemo(() => {
    const map = new Map<number, string>()
    locales.forEach((l) => map.set(Number(l.local_id), l.local_descripcion))
    return map
  }, [locales])

  const ventasByLocal = useMemo(() => {
    if (!isMultiLocal) return null
    const groups = new Map<number, PosVenta[]>()
    for (const v of ventas) {
      const lid = v.id_local
      if (!groups.has(lid)) groups.set(lid, [])
      groups.get(lid)!.push(v)
    }
    return groups
  }, [ventas, isMultiLocal])

  const columns: Column<PosVenta & { id: string }>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: '140px',
      render: (v) => <span className="text-body">{v.fecha?.slice(0, 16) ?? '—'}</span>,
    },
    {
      key: 'comprobante',
      header: 'Comprobante',
      width: '160px',
      hideOnMobile: true,
      render: (v) => (
        <span className="text-body">
          {v.documento}{' '}
          <span className="text-mid-gray">{v.serie}-{v.correlativo}</span>
        </span>
      ),
    },
    {
      key: 'canal',
      header: 'Canal',
      width: '120px',
      hideOnMobile: true,
      render: (v) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
          {v.canalventa || v.nombre_canaldelivery || '—'}
        </span>
      ),
    },
    {
      key: 'tipoPago',
      header: 'Pago',
      width: '100px',
      render: (v) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
          {v.tipo_pago || '—'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      width: '120px',
      primary: true,
      render: (v) => <span className="font-semibold text-dark-graphite">{formatCurrency(num(v.total))}</span>,
    },
  ]

  function addId(list: PosVenta[]) {
    return list.map((v) => ({ ...v, id: v.ID ?? String(Math.random()) }))
  }

  function calcTotals(list: PosVenta[]) {
    return {
      count: list.length,
      ventas: list.reduce((sum, v) => sum + num(v.total), 0),
      impuestos: list.reduce((sum, v) => sum + num(v.impuestos), 0),
      propinas: list.reduce((sum, v) => sum + (v.lista_propinas?.reduce((s, p) => s + num(p.montoConIgv), 0) ?? 0), 0),
    }
  }

  const totalStats = calcTotals(ventas)

  return (
    <div>
      {/* Consultar button */}
      <div className="mb-5">
        <button
          onClick={handleConsultar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-dark-graphite text-white rounded-lg text-body font-medium hover:bg-graphite transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Consultar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-body mb-4">
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && ventas.length === 0 && !error && (
        <EmptyState
          icon={Search}
          title="Sin resultados"
          description="Selecciona un rango de fechas y presiona Consultar para ver las ventas del POS."
        />
      )}

      {ventas.length > 0 && (
        <>
          {/* Combined summary cards */}
          <SummaryCards stats={totalStats} />

          {/* Grouped by local or single table */}
          {isMultiLocal && ventasByLocal ? (
            Array.from(ventasByLocal.entries()).map(([lid, localVentas]) => {
              const localStats = calcTotals(localVentas)
              return (
                <div key={lid} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={16} className="text-mid-gray" />
                    <h3 className="text-body font-semibold text-dark-graphite">
                      {localNameMap.get(lid) ?? `Local ${lid}`}
                    </h3>
                    <span className="text-caption text-mid-gray">
                      {localStats.count} registros · {formatCurrency(localStats.ventas)}
                    </span>
                  </div>
                  <DataTable columns={columns} data={addId(localVentas)} />
                </div>
              )
            })
          ) : (
            <DataTable columns={columns} data={addId(ventas)} />
          )}
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-mid-gray" />
          <span className="ml-2 text-body text-mid-gray">Consultando ventas del POS...</span>
        </div>
      )}
    </div>
  )
}

function SummaryCards({ stats }: { stats: { count: number; ventas: number; impuestos: number; propinas: number } }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <div className="bg-surface rounded-xl card-elevated p-4">
        <span className="block text-caption text-mid-gray mb-1">Registros</span>
        <span className="text-subheading font-bold text-dark-graphite">{stats.count}</span>
      </div>
      <div className="bg-surface rounded-xl card-elevated p-4">
        <span className="block text-caption text-mid-gray mb-1">Total Ventas</span>
        <span className="text-subheading font-bold text-emerald-700">{formatCurrency(stats.ventas)}</span>
      </div>
      <div className="bg-surface rounded-xl card-elevated p-4">
        <span className="block text-caption text-mid-gray mb-1">Impuestos</span>
        <span className="text-subheading font-bold text-dark-graphite">{formatCurrency(stats.impuestos)}</span>
      </div>
      <div className="bg-surface rounded-xl card-elevated p-4">
        <span className="block text-caption text-mid-gray mb-1">Propinas</span>
        <span className="text-subheading font-bold text-dark-graphite">{formatCurrency(stats.propinas)}</span>
      </div>
    </div>
  )
}
