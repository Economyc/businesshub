import { useMemo, useState } from 'react'
import { Search, Loader2, MapPin, FileText, DollarSign, Receipt, Heart } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas } from '../hooks'
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

export function VentasTab({ localIds, locales }: VentasTabProps) {
  const { startDate, endDate } = useDateRange()
  const { ventas, loading, error, fetch } = usePosVentas()
  const prefersReducedMotion = useReducedMotion()
  const [docFilter, setDocFilter] = useState<DocType | 'todos'>('todos')
  const isMultiLocal = localIds.length > 1

  function handleConsultar() {
    fetch(localIds, `${toDateStr(startDate)} 00:00:00`, `${toDateStr(endDate)} 23:59:59`)
  }

  const localNameMap = useMemo(() => {
    const map = new Map<number, string>()
    locales.forEach((l) => map.set(Number(l.local_id), l.local_descripcion))
    return map
  }, [locales])

  const filteredVentas = useMemo(() => {
    if (docFilter === 'todos') return ventas
    return ventas.filter((v) => getDocType(v) === docFilter)
  }, [ventas, docFilter])

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
      {/* Consultar button */}
      <div className="mb-5">
        <button
          onClick={handleConsultar}
          disabled={loading}
          className="flex items-center gap-2 h-10 px-5 bg-dark-graphite text-white rounded-[10px] text-body font-medium hover:bg-graphite transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Consultar ventas"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Consultando...
            </>
          ) : (
            <>
              <Search size={16} />
              Consultar
            </>
          )}
        </button>
      </div>

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
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-body mb-4">{error}</div>
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
          {/* Summary cards with icons and semantic colors */}
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
                  <DataTable columns={columns} data={addId(localVentas)} />
                </div>
              )
            })
          ) : (
            <DataTable columns={columns} data={addId(filteredVentas)} />
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
