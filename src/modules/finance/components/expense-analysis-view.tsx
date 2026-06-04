import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Building2,
  Receipt,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { EmptyState } from '@/core/ui/empty-state'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { chartColors, chartCategorical } from '@/core/ui/chart-colors'
import { InlineAgentSheet } from '@/modules/agent/components/inline-agent-sheet'
import { useExpenseAnalysis, type ExpenseGroup } from '../hooks'
import { useDateRange } from '../context/date-range-context'
import { DateRangePicker } from './date-range-picker'

type Dimension = 'category' | 'supplier' | 'supplierCategory'

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'category', label: 'Categoría' },
  { key: 'supplier', label: 'Proveedor' },
  { key: 'supplierCategory', label: 'Categoría de proveedor' },
]

function groupColor(index: number): string {
  return index < chartCategorical.length ? chartCategorical[index] : chartColors.muted
}

// Variación vs período anterior. En gastos, subir es malo (rojo) y bajar es
// bueno (verde) — al revés que en ingresos.
function DeltaBadge({ group }: { group: ExpenseGroup }) {
  if (group.prevTotal === 0) {
    return <span className="text-caption text-mid-gray">nuevo</span>
  }
  const up = group.deltaPct >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-caption',
        up ? 'text-negative-text' : 'text-positive-text',
      )}
    >
      {up ? (
        <TrendingUp size={12} strokeWidth={1.5} />
      ) : (
        <TrendingDown size={12} strokeWidth={1.5} />
      )}
      {Math.abs(group.deltaPct).toFixed(0)}%
    </span>
  )
}

function RankRow({ group, color, depth = 0 }: { group: ExpenseGroup; color: string; depth?: number }) {
  const [open, setOpen] = useState(false)
  // Solo anidamos cuando hay más de una subcategoría real; si la madre no tiene
  // subcategorías (todo cae en "Sin subcategoría") expandimos directo a las
  // transacciones, sin un dropdown intermedio redundante.
  const hasSubgroups = (group.subgroups?.length ?? 0) > 1
  const isSub = depth > 0

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full ${isSub ? 'px-3 py-2.5' : 'px-4 py-3'} hover:bg-bone/40 transition-colors duration-150 rounded-lg text-left`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {open ? (
              <ChevronDown size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
            ) : (
              <ChevronRight size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
            )}
            <span
              className={`rounded-full shrink-0 ${isSub ? 'size-1.5 opacity-60' : 'size-2'}`}
              style={{ backgroundColor: color }}
            />
            <span className="text-body text-graphite truncate">{group.label}</span>
            <span className="text-caption text-mid-gray shrink-0">
              ({group.transactions.length})
            </span>
          </div>
          <span className="text-body font-medium text-dark-graphite shrink-0">
            {formatCurrency(group.total)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 pl-6">
          <div className="flex-1 h-1.5 rounded-full bg-bone overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${group.share}%`, backgroundColor: color, opacity: isSub ? 0.6 : 1 }}
            />
          </div>
          <span className="text-caption text-mid-gray w-9 text-right shrink-0">
            {group.share.toFixed(0)}%
          </span>
          {!isSub && (
            <span className="w-12 text-right shrink-0">
              <DeltaBadge group={group} />
            </span>
          )}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {hasSubgroups ? (
              <div className="pl-5 pr-1 pb-1">
                {group.subgroups!.map((sg) => (
                  <RankRow key={sg.key} group={sg} color={color} depth={depth + 1} />
                ))}
              </div>
            ) : (
              <div className="pl-12 pr-4 pb-2">
                {group.transactions.slice(0, 50).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between py-1.5 text-caption"
                  >
                    <span className="text-mid-gray truncate mr-3">{t.concept}</span>
                    <span className="text-graphite shrink-0">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
                {group.transactions.length > 50 && (
                  <div className="py-1.5 text-caption text-mid-gray">
                    +{group.transactions.length - 50} movimientos más
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload as { name: string; value: number; share: number } | undefined
  if (!p) return null
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-caption">
      <p className="text-dark-graphite font-medium mb-0.5">{p.name}</p>
      <p className="text-mid-gray">
        {formatCurrency(p.value)} · {p.share.toFixed(0)}%
      </p>
    </div>
  )
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-caption">
      <p className="text-dark-graphite font-medium mb-0.5">{label}</p>
      <p className="text-mid-gray">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

export function ExpenseAnalysisView() {
  const { startDate, endDate, presetLabel } = useDateRange()
  const { data, loading } = useExpenseAnalysis(startDate, endDate)
  const [dimension, setDimension] = useState<Dimension>('category')
  const [aiOpen, setAiOpen] = useState(false)

  const activeGroups =
    dimension === 'category'
      ? data.byCategory
      : dimension === 'supplier'
        ? data.bySupplier
        : data.bySupplierCategory

  const donutData = useMemo(() => {
    const top = activeGroups.slice(0, 6)
    const rest = activeGroups.slice(6)
    const restTotal = rest.reduce((s, g) => s + g.total, 0)
    const out = top.map((g, i) => ({
      name: g.label,
      value: g.total,
      share: g.share,
      color: groupColor(i),
    }))
    if (restTotal > 0) {
      out.push({
        name: 'Otros',
        value: restTotal,
        share: data.total > 0 ? (restTotal / data.total) * 100 : 0,
        color: chartColors.muted,
      })
    }
    return out
  }, [activeGroups, data.total])

  const supplierPct = data.total > 0 ? (data.supplierSpend / data.total) * 100 : 0

  const aiSnapshot = useMemo(
    () => ({
      periodo: presetLabel,
      gastoTotal: data.total,
      variacionVsPeriodoAnterior: `${data.totalDeltaPct >= 0 ? '+' : ''}${data.totalDeltaPct.toFixed(1)}%`,
      proveedoresEInsumos: data.supplierSpend,
      otrosGastos: data.otherSpend,
      topCategorias: data.byCategory
        .slice(0, 5)
        .map((g) => `${g.label}: ${formatCurrency(g.total)} (${g.share.toFixed(0)}%)`),
      topProveedores: data.bySupplier
        .slice(0, 5)
        .map((g) => `${g.label}: ${formatCurrency(g.total)} (${g.share.toFixed(0)}%)`),
      porCategoriaProveedor: data.bySupplierCategory
        .slice(0, 5)
        .map((g) => `${g.label}: ${formatCurrency(g.total)} (${g.share.toFixed(0)}%)`),
    }),
    [data, presetLabel],
  )

  return (
    <PageTransition>
      <PageHeader title="Análisis Finanzas">
        <DateRangePicker />
        <button
          onClick={() => setAiOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-colors duration-200 whitespace-nowrap"
        >
          <Sparkles size={15} strokeWidth={1.5} className="text-mid-gray" />
          <span className="font-medium text-dark-graphite">Analizar con IA</span>
        </button>
      </PageHeader>

      {loading ? (
        <DashboardSkeleton kpiCount={4} charts={1} />
      ) : data.transactionCount === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin gastos pagados en el período"
          description="Ajusta el rango de fechas o registra movimientos para ver el análisis de gastos."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPIs */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <KPICard
              label="Gasto total"
              value={data.total}
              format="currency"
              icon={Wallet}
              inverse
              trend={data.totalDeltaPct >= 0 ? 'up' : 'down'}
              change={`${Math.abs(data.totalDeltaPct).toFixed(1)}% vs anterior`}
            />
            <KPICard
              label="Proveedores e insumos"
              value={data.supplierSpend}
              format="currency"
              icon={Package}
              comparison={`${supplierPct.toFixed(0)}% del total`}
            />
            <KPICard
              label="Otros gastos"
              value={data.otherSpend}
              format="currency"
              icon={Building2}
              comparison={`${(100 - supplierPct).toFixed(0)}% del total`}
            />
            <KPICard
              label="Movimientos"
              value={data.transactionCount}
              format="number"
              icon={Receipt}
            />
          </motion.div>

          {/* Composición agrupada: proveedores/insumos vs otros */}
          <div className="bg-surface rounded-xl card-elevated p-4 sm:p-[18px]">
            <span className="text-caption text-mid-gray">Composición del gasto</span>
            <div className="flex h-3 rounded-full overflow-hidden bg-bone mt-3">
              <div style={{ width: `${supplierPct}%`, backgroundColor: chartColors.info }} />
              <div
                style={{ width: `${100 - supplierPct}%`, backgroundColor: chartColors.neutral }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-caption">
              <span className="flex items-center gap-1.5 text-graphite">
                <span className="size-2 rounded-full" style={{ backgroundColor: chartColors.info }} />
                Proveedores e insumos · {formatCurrency(data.supplierSpend)} ({supplierPct.toFixed(0)}%)
              </span>
              <span className="flex items-center gap-1.5 text-graphite">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: chartColors.neutral }}
                />
                Otros gastos · {formatCurrency(data.otherSpend)} ({(100 - supplierPct).toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Selector de dimensión */}
          <div className="inline-flex w-fit rounded-lg border border-border/60 bg-bone/40 p-1 gap-1">
            {DIMENSIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDimension(d.key)}
                className={cn(
                  'px-3 sm:px-4 py-1.5 rounded-lg text-body transition-colors duration-150',
                  dimension === d.key
                    ? 'bg-surface text-dark-graphite font-medium'
                    : 'text-mid-gray hover:text-graphite',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut composición de la dimensión activa */}
            <div className="bg-surface rounded-xl card-elevated p-4 sm:p-[18px]">
              <h2 className="text-subheading font-medium text-dark-graphite mb-1">Composición</h2>
              <p className="text-caption text-mid-gray mb-2">
                {DIMENSIONS.find((d) => d.key === dimension)?.label}
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={1}
                    isAnimationActive={false}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke={chartColors.surface} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Tendencia mensual del gasto */}
            <div className="bg-surface rounded-xl card-elevated p-4 sm:p-[18px]">
              <h2 className="text-subheading font-medium text-dark-graphite mb-1">
                Tendencia mensual
              </h2>
              <p className="text-caption text-mid-gray mb-2">Gasto total por mes</p>
              {data.monthlyTrend.length <= 1 ? (
                <div className="flex items-center justify-center h-[240px] text-caption text-mid-gray">
                  Selecciona un rango de varios meses para ver la tendencia
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.monthlyTrend}
                    margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 11, fill: chartColors.text }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        `$${Number(v).toLocaleString('es-CO', {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        })}`
                      }
                      tick={{ fontSize: 11, fill: chartColors.text }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                    />
                    <Tooltip
                      content={<TrendTooltip />}
                      cursor={{ fill: 'var(--app-bone)' }}
                    />
                    <Bar dataKey="total" fill={chartColors.info} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Ranking de la dimensión activa */}
          <div className="bg-surface rounded-xl card-elevated overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <span className="text-body font-medium text-dark-graphite">
                Ranking · {DIMENSIONS.find((d) => d.key === dimension)?.label}
              </span>
              <span className="text-caption text-mid-gray">{activeGroups.length} rubros</span>
            </div>
            <div className="py-1 px-1">
              {activeGroups.map((group, i) => (
                <RankRow key={group.key} group={group} color={groupColor(i)} />
              ))}
            </div>
          </div>
        </div>
      )}

      <InlineAgentSheet
        open={aiOpen}
        onOpenChange={setAiOpen}
        module="Análisis Finanzas"
        contextSnapshot={aiSnapshot}
      />
    </PageTransition>
  )
}
