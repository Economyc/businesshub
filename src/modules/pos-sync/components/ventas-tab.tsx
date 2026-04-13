import { useMemo, useState, useEffect } from 'react'
import { Search, RefreshCw, Loader2, MapPin, FileText, DollarSign, Receipt, Heart, Clock } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas, useAutoRefresh } from '../hooks'
import { VentaDetailDrawer } from './venta-detail-drawer'
import type { PosVenta, PosLocal } from '../types'
import type { LucideIcon } from 'lucide-react'

function num(val: string | number | undefined): number {
  return Number(val) || 0
}

type DocType = 'factura' | 'boleta' | 'nota' | 'otro'

function getDocType(v: PosVenta): DocType {
  const td = v.tipo_documento?.toUpperCase()
  if (td === 'F') return 'factura'
  if (td === 'B') return 'boleta'
  // Check documento field for "Nota de Venta" text
  if (td === 'NV' || v.documento?.toLowerCase().includes('nota')) return 'nota'
  return 'otro'
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  nota: 'Nota',
  otro: 'Otro',
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface VentasTabProps {
  localIds: number[]
  allLocalIds: number[]
  locales: PosLocal[]
}

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' },
  }),
}

interface CardConfig {
  label: string
  icon: LucideIcon
  colorClass: string
  format: (stats: ReturnType<typeof calcTotals>) => string
}

const CARDS_CONFIG: CardConfig[] = [
  {
    label: 'Registros',
    icon: FileText,
    colorClass: 'text-dark-graphite',
    format: (s) => String(s.count),
  },
  {
    label: 'Total Ventas',
    icon: DollarSign,
    colorClass: 'text-positive-text',
    format: (s) => formatCurrency(s.ventas),
  },
  {
    label: 'Impuestos',
    icon: Receipt,
    colorClass: 'text-info-text',
    format: (s) => formatCurrency(s.impuestos),
  },
  {
    label: 'Propinas',
    icon: Heart,
    colorClass: 'text-warning-text',
    format: (s) => formatCurrency(s.propinas),
  },
]

function calcTotals(list: PosVenta[]) {
  return {
    count: list.length,
    ventas: list.reduce((sum, v) => sum + num(v.total), 0),
    impuestos: list.reduce((sum, v) => sum + num(v.impuestos), 0),
    propinas: list.reduce(
      (sum, v) => sum + (v.lista_propinas?.reduce((s, p) => s + num(p.montoConIgv), 0) ?? 0),
      0
    ),
  }
}

export function VentasTab({ localIds, allLocalIds, locales }: VentasTabProps) {
  const { startDate, endDate } = useDateRange()
  const { ventas, loading, error, rateLimited, lastUpdated, fromCache, fetch, progress } = usePosVentas()
  const prefersReducedMotion = useReducedMotion()
  const [docFilter, setDocFilter] = useState<DocType | 'todos'>('todos')
  const [cajaFilter, setCajaFilter] = useState<string>('todas')
  const [selectedVenta, setSelectedVenta] = useState<PosVenta | null>(null)
  const isMultiLocal = localIds.length > 1

  function handleConsultar() {
    // Always fetch ALL locals so switching pills filters in-memory without re-fetching
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

  const filteredVentas = useMemo(() => {
    let result = ventas
    // Exclude anuladas — they have their own tab
    result = result.filter((v) => v.estado_txt?.toLowerCase() !== 'comprobante anulado')
    // Filter by selected local(s) — allows switching pills without re-fetching
    const localSet = new Set(localIds)
    result = result.filter((v) => localSet.has(v.id_local))
    if (docFilter !== 'todos') {
      result = result.filter((v) => getDocType(v) === docFilter)
    }
    if (cajaFilter !== 'todas') {
      result = result.filter((v) => String(v.caja_id) === cajaFilter)
    }
    return result
  }, [ventas, localIds, docFilter, cajaFilter])

  // Cajas disponibles según local(es) seleccionado(s) y filtro de tipo
  const cajasDisponibles = useMemo(() => {
    const localSet = new Set(localIds)
    const counts = new Map<string, number>()
    for (const v of ventas) {
      if (v.estado_txt?.toLowerCase() === 'comprobante anulado') continue
      if (!localSet.has(v.id_local)) continue
      if (docFilter !== 'todos' && getDocType(v) !== docFilter) continue
      const k = String(v.caja_id ?? '?')
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [ventas, localIds, docFilter])

  // Reset caja filter si la caja seleccionada ya no existe
  useEffect(() => {
    if (cajaFilter === 'todas') return
    if (!cajasDisponibles.some(([k]) => k === cajaFilter)) setCajaFilter('todas')
  }, [cajasDisponibles, cajaFilter])

  const ventasByLocal = useMemo(() => {
    if (!isMultiLocal) return null
    const groups = new Map<number, PosVenta[]>()
    for (const v of filteredVentas) {
      const lid = v.id_local
      if (!groups.has(lid)) groups.set(lid, [])
      groups.get(lid)!.push(v)
    }
    return groups
  }, [filteredVentas, isMultiLocal])

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
      render: (v) => {
        const docType = getDocType(v)
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
            {DOC_TYPE_LABELS[docType]}
          </span>
        )
      },
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
      key: 'estado',
      header: 'Estado',
      width: '100px',
      hideOnMobile: true,
      render: (v) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
          {v.estado_txt || v.estado || '—'}
        </span>
      ),
    },
    {
      key: 'caja',
      header: 'Caja',
      width: '80px',
      hideOnMobile: true,
      render: (v) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
          {v.caja_id ?? '—'}
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
      render: (v) => (
        <span className="font-semibold text-dark-graphite">{formatCurrency(num(v.total))}</span>
      ),
    },
  ]

  function addId(list: PosVenta[]) {
    return list.map((v) => ({ ...v, id: v.ID ?? String(Math.random()) }))
  }

  const totalStats = calcTotals(filteredVentas)

  return (
    <div>
      {/* Doc type filter */}
      {ventas.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-caption text-mid-gray">Tipo:</span>
          {(['todos', 'factura', 'boleta', 'nota', 'otro'] as const).map((type) => {
            const count = type === 'todos'
              ? ventas.length
              : ventas.filter((v) => getDocType(v) === type).length
            if (type !== 'todos' && count === 0) return null
            return (
              <button
                key={type}
                onClick={() => setDocFilter(type)}
                className={`px-3 py-1 rounded-full text-caption transition-colors ${
                  docFilter === type
                    ? 'bg-dark-graphite text-white'
                    : 'bg-bone text-graphite hover:bg-mid-gray/20'
                }`}
              >
                {type === 'todos' ? 'Todos' : DOC_TYPE_LABELS[type]} ({count})
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-2">
            {lastUpdated && (
              <span className="flex items-center gap-1 text-caption text-mid-gray">
                <Clock size={12} />
                {lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                {fromCache && ' (cache)'}
              </span>
            )}
            <button
              onClick={handleConsultar}
              disabled={loading}
              className="flex items-center gap-1 text-caption text-mid-gray hover:text-dark-graphite transition-colors disabled:opacity-50"
              aria-label="Actualizar ventas"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Actualizar
            </button>
          </div>
        </div>
      )}

      {/* Caja filter */}
      {ventas.length > 0 && cajasDisponibles.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-caption text-mid-gray">Caja:</span>
          <button
            onClick={() => setCajaFilter('todas')}
            className={`px-3 py-1 rounded-full text-caption transition-colors ${
              cajaFilter === 'todas'
                ? 'bg-dark-graphite text-white'
                : 'bg-bone text-graphite hover:bg-mid-gray/20'
            }`}
          >
            Todas ({cajasDisponibles.reduce((s, [, c]) => s + c, 0)})
          </button>
          {cajasDisponibles.map(([id, count]) => (
            <button
              key={id}
              onClick={() => setCajaFilter(id)}
              className={`px-3 py-1 rounded-full text-caption transition-colors ${
                cajaFilter === id
                  ? 'bg-dark-graphite text-white'
                  : 'bg-bone text-graphite hover:bg-mid-gray/20'
              }`}
            >
              Caja {id} ({count})
            </button>
          ))}
        </div>
      )}

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

      {/* Results */}
      {!loading && ventas.length === 0 && !error && (
        <div className="flex flex-col items-center">
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="Las ventas se cargan automáticamente. Presiona Consultar si necesitas refrescar."
          />
          <button
            onClick={handleConsultar}
            className="mt-2 flex items-center gap-2 h-9 px-4 bg-dark-graphite text-white rounded-[10px] text-caption font-medium hover:bg-graphite transition-colors"
          >
            <RefreshCw size={14} />
            Consultar
          </button>
        </div>
      )}

      {ventas.length > 0 && (
        <>
          {/* Summary cards */}
          <SummaryCards stats={totalStats} prefersReducedMotion={prefersReducedMotion} />

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
                  <DataTable columns={columns} data={addId(localVentas)} onRowClick={setSelectedVenta} />
                </div>
              )
            })
          ) : (
            <DataTable columns={columns} data={addId(filteredVentas)} onRowClick={setSelectedVenta} />
          )}
        </>
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

function SummaryCards({
  stats,
  prefersReducedMotion,
}: {
  stats: ReturnType<typeof calcTotals>
  prefersReducedMotion: boolean | null
}) {
  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
      aria-live="polite"
      initial="hidden"
      animate="visible"
    >
      {CARDS_CONFIG.map((card, i) => {
        const Icon = card.icon
        return (
          <motion.div
            key={card.label}
            className="bg-surface rounded-xl card-elevated p-4"
            custom={i}
            variants={prefersReducedMotion ? undefined : cardVariants}
            initial={prefersReducedMotion ? undefined : 'hidden'}
            animate={prefersReducedMotion ? undefined : 'visible'}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={16} className={card.colorClass} />
              <span className="text-caption text-mid-gray">{card.label}</span>
            </div>
            <span className={`text-kpi font-bold ${card.colorClass}`}>{card.format(stats)}</span>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
