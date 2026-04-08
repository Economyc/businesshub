import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { usePosVentas } from '../hooks'
import type { PosVenta } from '../types'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function num(val: string | number | undefined): number {
  return Number(val) || 0
}

interface VentasTabProps {
  localId: number
}

export function VentasTab({ localId }: VentasTabProps) {
  const [f1, setF1] = useState(todayStr())
  const [f2, setF2] = useState(todayStr())
  const { ventas, loading, error, fetch } = usePosVentas()

  function handleConsultar() {
    fetch(localId, `${f1} 00:00:00`, `${f2} 23:59:59`)
  }

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

  // Add id field for DataTable
  const data = ventas.map((v) => ({ ...v, id: v.ID ?? String(Math.random()) }))

  // Summary totals
  const totalVentas = ventas.reduce((sum, v) => sum + num(v.total), 0)
  const totalImpuesto = ventas.reduce((sum, v) => sum + num(v.impuestos), 0)
  const totalPropinas = ventas.reduce((sum, v) => sum + v.lista_propinas?.reduce((s, p) => s + num(p.montoConIgv), 0) ?? 0, 0)

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-caption text-mid-gray mb-1">Desde</label>
          <input
            type="date"
            value={f1}
            onChange={(e) => setF1(e.target.value)}
            className="text-body bg-surface border border-border rounded-lg px-3 py-2 text-graphite"
          />
        </div>
        <div>
          <label className="block text-caption text-mid-gray mb-1">Hasta</label>
          <input
            type="date"
            value={f2}
            onChange={(e) => setF2(e.target.value)}
            className="text-body bg-surface border border-border rounded-lg px-3 py-2 text-graphite"
          />
        </div>
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

      {data.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-surface rounded-xl card-elevated p-4">
              <span className="block text-caption text-mid-gray mb-1">Registros</span>
              <span className="text-subheading font-bold text-dark-graphite">{ventas.length}</span>
            </div>
            <div className="bg-surface rounded-xl card-elevated p-4">
              <span className="block text-caption text-mid-gray mb-1">Total Ventas</span>
              <span className="text-subheading font-bold text-emerald-700">{formatCurrency(totalVentas)}</span>
            </div>
            <div className="bg-surface rounded-xl card-elevated p-4">
              <span className="block text-caption text-mid-gray mb-1">Impuestos</span>
              <span className="text-subheading font-bold text-dark-graphite">{formatCurrency(totalImpuesto)}</span>
            </div>
            <div className="bg-surface rounded-xl card-elevated p-4">
              <span className="block text-caption text-mid-gray mb-1">Propinas</span>
              <span className="text-subheading font-bold text-dark-graphite">{formatCurrency(totalPropinas)}</span>
            </div>
          </div>

          <DataTable columns={columns} data={data} />
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
