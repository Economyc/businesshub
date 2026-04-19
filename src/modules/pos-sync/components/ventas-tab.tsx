import { useMemo, useState, useEffect, useRef } from 'react'
import { Search, RefreshCw, Loader2, MapPin, Receipt, Heart, Clock, TrendingUp } from 'lucide-react'
import { motion, useReducedMotion, useMotionValue, useTransform, animate, type Variants } from 'framer-motion'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { SegmentedFilter, type SegmentedFilterOption } from '@/core/ui/segmented-filter'
import { PosHeroSkeleton, PosSummaryCardsSkeleton, TableSkeleton } from '@/core/ui/skeleton'
import { formatCurrency } from '@/core/utils/format'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosVentas } from '../hooks'
import { calcTotals, num, toDateStrLocal, type PosTotals } from '../utils/sales-calculations'
import { VentaDetailDrawer } from './venta-detail-drawer'
import type { PosVenta, PosLocal } from '../types'
import type { LucideIcon } from 'lucide-react'

type DocType = 'factura' | 'boleta' | 'nota' | 'otro'

function getDocType(v: PosVenta): DocType {
  const td = v.tipo_documento?.toUpperCase()
  if (td === 'F') return 'factura'
  if (td === 'B') return 'boleta'
  if (td === 'NV' || v.documento?.toLowerCase().includes('nota')) return 'nota'
  return 'otro'
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  nota: 'Nota',
  otro: 'Otro',
}

const toDateStr = toDateStrLocal

interface VentasTabProps {
  localIds: number[]
  allLocalIds: number[]
  locales: PosLocal[]
  localLabel: string | null
}

function getEstadoTone(estado: string | undefined): 'positive' | 'warning' | 'neutral' {
  const e = (estado ?? '').toLowerCase()
  if (!e || e === '—') return 'neutral'
  if (e.includes('anulado') || e.includes('pendiente')) return 'warning'
  if (e.includes('pagado') || e.includes('aceptado') || e.includes('emitido') || e.includes('activo')) return 'positive'
  return 'neutral'
}

function getEstadoLabel(estado: string | undefined): string {
  const e = (estado ?? '').trim()
  if (!e) return '—'
  const cleaned = e.replace(/^comprobante\s+/i, '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
}

function getCanalTone(canal: string | undefined): 'info' | 'neutral' {
  const c = (canal ?? '').toLowerCase()
  if (!c) return 'neutral'
  if (c.includes('delivery') || c.includes('rappi') || c.includes('pedidos') || c.includes('didi') || c.includes('uber')) return 'info'
  return 'neutral'
}

const TONE_CLASSES: Record<string, string> = {
  positive: 'bg-positive-bg text-positive-text',
  warning: 'bg-warning-bg text-warning-text',
  info: 'bg-info-bg text-info-text',
  neutral: 'bg-bone text-graphite',
}

export function VentasTab({ localIds, allLocalIds, locales, localLabel }: VentasTabProps) {
  const { startDate, endDate } = useDateRange()
  const startDateStr = toDateStr(startDate)
  const endDateStr = toDateStr(endDate)
  const { ventas, loading, error, rateLimited, lastUpdated, fromCache, refetch, progress } = usePosVentas({
    localIds: allLocalIds,
    startDate: startDateStr,
    endDate: endDateStr,
    enabled: allLocalIds.length > 0,
  })
  const prefersReducedMotion = useReducedMotion()
  const [docFilter, setDocFilter] = useState<DocType | 'todos'>('todos')
  const [cajaFilter, setCajaFilter] = useState<string>('todas')
  const [search, setSearch] = useState('')
  const [selectedVenta, setSelectedVenta] = useState<PosVenta | null>(null)
  const isMultiLocal = localIds.length > 1

  function handleConsultar() {
    refetch()
  }

  const localNameMap = useMemo(() => {
    const map = new Map<number, string>()
    locales.forEach((l) => map.set(Number(l.local_id), l.local_descripcion))
    return map
  }, [locales])

  const filteredVentas = useMemo(() => {
    let result = ventas
    result = result.filter((v) => v.estado_txt?.toLowerCase() !== 'comprobante anulado')
    const localSet = new Set(localIds)
    result = result.filter((v) => localSet.has(v.id_local))
    if (docFilter !== 'todos') {
      result = result.filter((v) => getDocType(v) === docFilter)
    }
    if (cajaFilter !== 'todas') {
      result = result.filter((v) => String(v.caja_id) === cajaFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((v) => {
        const haystack = [
          v.documento,
          v.serie,
          v.correlativo,
          v.canalventa,
          v.nombre_canaldelivery,
          v.tipo_pago,
          v.caja_id,
          v.estado_txt,
          String(num(v.total)),
        ]
          .filter((x) => x !== undefined && x !== null && x !== '')
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    }
    return result
  }, [ventas, localIds, docFilter, cajaFilter, search])

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

  const docCounts = useMemo(() => {
    const localSet = new Set(localIds)
    const base = ventas.filter(
      (v) => v.estado_txt?.toLowerCase() !== 'comprobante anulado' && localSet.has(v.id_local)
    )
    return {
      todos: base.length,
      factura: base.filter((v) => getDocType(v) === 'factura').length,
      boleta: base.filter((v) => getDocType(v) === 'boleta').length,
      nota: base.filter((v) => getDocType(v) === 'nota').length,
      otro: base.filter((v) => getDocType(v) === 'otro').length,
    }
  }, [ventas, localIds])

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
          {DOC_TYPE_LABELS[getDocType(v)]}
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
      key: 'canal',
      header: 'Canal',
      width: '120px',
      hideOnMobile: true,
      render: (v) => {
        const isRappi = (v.nombre_canaldelivery ?? '').trim().toLowerCase() === 'rappi'
        if (isRappi) {
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-caption font-medium text-white"
              style={{ backgroundColor: '#FF4219' }}
            >
              RAPPI
            </span>
          )
        }
        const canal = v.canalventa || v.nombre_canaldelivery || '—'
        const tone = getCanalTone(v.canalventa || v.nombre_canaldelivery)
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption ${TONE_CLASSES[tone]}`}>
            {canal}
          </span>
        )
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '110px',
      hideOnMobile: true,
      render: (v) => {
        const tone = getEstadoTone(v.estado_txt || v.estado)
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption ${TONE_CLASSES[tone]}`}>
            {tone === 'positive' && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
            {tone === 'warning' && <span className="w-1 h-1 rounded-full bg-amber-500" />}
            {getEstadoLabel(v.estado_txt || v.estado)}
          </span>
        )
      },
    },
    {
      key: 'caja',
      header: 'Caja',
      width: '80px',
      hideOnMobile: true,
      render: (v) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite tabular-nums">
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
        <span className="font-semibold text-dark-graphite tabular-nums">{formatCurrency(num(v.total))}</span>
      ),
    },
  ]

  function addId(list: PosVenta[]) {
    return list.map((v) => ({ ...v, id: v.ID ?? String(Math.random()) }))
  }

  const totalStats = calcTotals(filteredVentas)
  const hasData = ventas.length > 0
  const showSkeleton = loading && !hasData

  const docOptions: SegmentedFilterOption<DocType | 'todos'>[] = [
    { value: 'todos', label: 'Todos', count: docCounts.todos },
    { value: 'factura', label: 'Factura', count: docCounts.factura },
    { value: 'boleta', label: 'Boleta', count: docCounts.boleta },
    { value: 'nota', label: 'Nota', count: docCounts.nota },
    { value: 'otro', label: 'Otro', count: docCounts.otro },
  ]

  const cajaOptions: SegmentedFilterOption<string>[] = [
    { value: 'todas', label: 'Todas', count: cajasDisponibles.reduce((s, [, c]) => s + c, 0) },
    ...cajasDisponibles.map(([id, count]) => ({ value: id, label: `Caja ${id}`, count })),
  ]

  if (showSkeleton) {
    return (
      <div>
        <PosHeroSkeleton />
        <PosSummaryCardsSkeleton />
        <TableSkeleton rows={6} columns={6} />
        {progress && (
          <div className="mt-3 flex items-center justify-center text-caption text-mid-gray">
            <Loader2 size={12} className="animate-spin mr-1.5" />
            Sincronizando periodo {progress.current} de {progress.total}…
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Hero — dashboard en vivo */}
      <HeroPanel
        localLabel={localLabel}
        stats={totalStats}
        loading={loading}
        lastUpdated={lastUpdated}
        fromCache={fromCache}
        onRefresh={handleConsultar}
        prefersReducedMotion={prefersReducedMotion}
        hasData={hasData}
      />

      {/* KPI cards secundarios */}
      {hasData && (
        <SummaryCards stats={totalStats} prefersReducedMotion={prefersReducedMotion} />
      )}

      {/* Toolbar — filtros + buscador */}
      {hasData && (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="inline-flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 bg-input-bg border border-input-border rounded-[10px] p-1">
              <SegmentedFilter
                ariaLabel="Tipo de comprobante"
                options={docOptions}
                value={docFilter}
                onChange={setDocFilter}
                hideZeroCount
              />
            </div>
            {cajasDisponibles.length > 1 && (
              <div className="inline-flex items-center gap-1 bg-input-bg border border-input-border rounded-[10px] p-1">
                <SegmentedFilter
                  ariaLabel="Caja"
                  options={cajaOptions}
                  value={cajaFilter}
                  onChange={setCajaFilter}
                />
              </div>
            )}
          </div>
          <div className="relative inline-flex items-center gap-2 h-10 pl-3.5 pr-2 bg-input-bg border border-input-border rounded-[10px] min-w-[240px] flex-1 md:flex-none md:w-[280px] focus-within:border-border-hover transition-colors">
            <Search size={15} strokeWidth={1.5} className="text-mid-gray shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar comprobante, canal, pago…"
              className="flex-1 min-w-0 bg-transparent outline-none text-body text-dark-graphite placeholder:text-mid-gray"
              aria-label="Buscar ventas"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-caption text-mid-gray hover:text-dark-graphite transition-colors shrink-0 px-1.5"
                aria-label="Limpiar búsqueda"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rate limit warning */}
      {rateLimited && hasData && (
        <div className="bg-warning-bg text-warning-text rounded-xl px-4 py-3 text-body mb-4 flex items-center gap-2">
          <Clock size={16} className="shrink-0" />
          La API del POS está procesando otra solicitud. Mostrando última consulta disponible.
        </div>
      )}

      {error && (
        <div className="bg-negative-bg text-negative-text rounded-xl px-4 py-3 text-body mb-4">{error}</div>
      )}

      {/* Empty */}
      {!loading && !hasData && !error && (
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

      {/* Results */}
      {hasData && (
        <>
          {isMultiLocal && ventasByLocal ? (
            Array.from(ventasByLocal.entries()).map(([lid, localVentas]) => {
              const localStats = calcTotals(localVentas)
              return (
                <div key={lid} className="mb-6">
                  <div className="flex items-center gap-3 mb-2 px-4 py-2.5 bg-bone/50 rounded-xl">
                    <MapPin size={14} className="text-mid-gray shrink-0" />
                    <h3 className="text-body font-semibold text-dark-graphite">
                      {localNameMap.get(lid) ?? `Local ${lid}`}
                    </h3>
                    <div className="ml-auto flex items-center gap-4 text-caption text-mid-gray tabular-nums">
                      <span>{localStats.count} reg.</span>
                      <span className="text-dark-graphite font-semibold">{formatCurrency(localStats.ventas)}</span>
                      <span className="hidden md:inline">ticket {formatCurrency(localStats.ticket)}</span>
                    </div>
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

      {loading && hasData && progress && (
        <div className="mt-3 flex items-center justify-center text-caption text-mid-gray">
          <Loader2 size={12} className="animate-spin mr-1.5" />
          Sincronizando periodo {progress.current} de {progress.total}…
        </div>
      )}

      <VentaDetailDrawer venta={selectedVenta} onClose={() => setSelectedVenta(null)} />
    </div>
  )
}

/* ---------- Hero ---------- */

interface HeroPanelProps {
  localLabel: string | null
  stats: PosTotals
  loading: boolean
  lastUpdated: Date | null
  fromCache: boolean
  onRefresh: () => void
  prefersReducedMotion: boolean | null
  hasData: boolean
}

function HeroPanel({
  localLabel,
  stats,
  loading,
  lastUpdated,
  fromCache,
  onRefresh,
  prefersReducedMotion,
  hasData,
}: HeroPanelProps) {
  return (
    <div className="relative bg-surface rounded-2xl card-elevated border border-bone/60 p-5 md:p-6 mb-4 overflow-hidden">
      <div className="flex items-stretch justify-between gap-4 flex-wrap">
        {/* Columna izquierda — KPI principal */}
        <div className="min-w-0 flex flex-col justify-between gap-3">
          <div className="text-caption uppercase tracking-wider text-mid-gray">
            Total ventas
          </div>
          <div>
            <div className="text-[44px] md:text-[52px] leading-none font-bold text-dark-graphite tabular-nums">
              <CountUp value={stats.ventas} format={formatCurrency} disabled={!!prefersReducedMotion} />
            </div>
            {hasData && (stats.propinas > 0 || stats.envio > 0) && (
              <div className="mt-2 flex items-center gap-3 text-caption text-mid-gray tabular-nums">
                {stats.propinas > 0 && <span>+ propinas {formatCurrency(stats.propinas)}</span>}
                {stats.envio > 0 && <span>+ envío {formatCurrency(stats.envio)}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha — acciones arriba, Local abajo */}
        <div className="flex flex-col justify-between items-end gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="flex items-center gap-1 text-caption text-mid-gray tabular-nums">
                <Clock size={12} />
                {lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                {fromCache && <span className="ml-1">(cache)</span>}
              </span>
            )}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1 text-caption text-mid-gray hover:text-dark-graphite transition-colors disabled:opacity-50"
              aria-label="Actualizar ventas"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Actualizar
            </button>
          </div>
          <div className="text-right min-w-0">
            <div className="text-caption uppercase tracking-wider text-mid-gray mb-1">Local</div>
            <div className="inline-flex items-center gap-1.5 text-body font-semibold text-dark-graphite truncate">
              <MapPin size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
              <span className="truncate">{localLabel ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sutil gradiente decorativo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, var(--color-dark-graphite, #1a1a1a), transparent 70%)' }}
      />
    </div>
  )
}

function CountUp({ value, format, disabled }: { value: number; format: (n: number) => string; disabled: boolean }) {
  const mv = useMotionValue(disabled ? value : 0)
  const rendered = useTransform(mv, (latest) => format(latest))
  const prevRef = useRef(value)

  useEffect(() => {
    if (disabled) {
      mv.set(value)
      prevRef.current = value
      return
    }
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: 'easeOut',
    })
    prevRef.current = value
    return controls.stop
  }, [value, disabled, mv])

  return <motion.span>{rendered}</motion.span>
}

/* ---------- KPI cards secundarios ---------- */

interface CardConfig {
  label: string
  icon: LucideIcon
  tone: 'info' | 'warning' | 'neutral'
  format: (stats: PosTotals) => string
}

const CARDS_CONFIG: CardConfig[] = [
  {
    label: 'Impuestos',
    icon: Receipt,
    tone: 'info',
    format: (s) => formatCurrency(s.impuestos),
  },
  {
    label: 'Propinas',
    icon: Heart,
    tone: 'warning',
    format: (s) => formatCurrency(s.propinas),
  },
  {
    label: 'Ticket promedio',
    icon: TrendingUp,
    tone: 'neutral',
    format: (s) => formatCurrency(s.ticket),
  },
]

const TONE_ICON: Record<string, string> = {
  info: 'text-info-text bg-info-bg',
  warning: 'text-warning-text bg-warning-bg',
  neutral: 'text-dark-graphite bg-bone',
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' },
  }),
}

function SummaryCards({
  stats,
  prefersReducedMotion,
}: {
  stats: PosTotals
  prefersReducedMotion: boolean | null
}) {
  return (
    <motion.div
      className="grid grid-cols-3 gap-3 mb-5"
      aria-live="polite"
      initial="hidden"
      animate="visible"
    >
      {CARDS_CONFIG.map((card, i) => {
        const Icon = card.icon
        return (
          <motion.div
            key={card.label}
            className="bg-surface rounded-xl border border-bone p-4 flex items-center gap-3"
            custom={i}
            variants={prefersReducedMotion ? undefined : cardVariants}
            initial={prefersReducedMotion ? undefined : 'hidden'}
            animate={prefersReducedMotion ? undefined : 'visible'}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TONE_ICON[card.tone]}`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-caption text-mid-gray truncate">{card.label}</div>
              <div className="text-body font-bold text-dark-graphite tabular-nums">
                {card.format(stats)}
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
