import { useRef } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, RefreshCw, ShieldCheck, PackageOpen } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { AnalyticsTabs } from './analytics-tabs'
import { ExportPDF } from './export-pdf'
import { ChartCard } from './shared/chart-card'
import { ChartTooltip } from './shared/chart-tooltip'
import { EmptyChart } from './shared/empty-chart'
import { CHART_SEMANTIC, CHART_AXIS_TICK, paletteColor } from './shared/chart-theme'
import { useCostStructure } from '../hooks'
import type { CategoryCost, CostGroup } from '../types'

const GROUP_BADGE_STYLES: Record<CostGroup, string> = {
  operativo: 'bg-positive-bg text-positive-text',
  obligaciones: 'bg-warning-bg text-warning-text',
  otros: 'bg-smoke text-mid-gray',
}

export function CostsDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, categories, monthlyCosts, loading } = useCostStructure()

  const categoryNames = categories.map((c) => c.category)
  const operativeCategories = categories.filter((c) => c.group === 'operativo')
  const obligationCategories = categories.filter((c) => c.group === 'obligaciones')
  const otherCategories = categories.filter((c) => c.group === 'otros')

  const costTrend: 'up' | 'down' | 'neutral' = kpis.totalChange.startsWith('+') ? 'down' : 'up'

  return (
    <PageTransition>
      <PageHeader title="Análisis">
        <DateRangePicker />
        <ExportPDF targetRef={dashboardRef} />
      </PageHeader>
      <AnalyticsTabs />

      {loading ? (
        <DashboardSkeleton kpiCount={5} charts={1} />
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <KPICard label="Gasto Total" value={kpis.totalCost} format="currency" change={kpis.totalChange} trend={costTrend} icon={DollarSign} />
            <KPICard label="Operativos" value={kpis.operativeCost} format="currency" change={kpis.operativeChange} trend={kpis.operativeChange.startsWith('+') ? 'down' : 'up'} icon={RefreshCw} />
            <KPICard label="Obligaciones" value={kpis.obligationsCost} format="currency" change={kpis.obligationsChange} trend={kpis.obligationsChange.startsWith('+') ? 'down' : 'up'} icon={ShieldCheck} />
            <KPICard label="Otros" value={kpis.otherCost} format="currency" change={kpis.otherChange} trend={kpis.otherChange.startsWith('+') ? 'down' : 'up'} icon={PackageOpen} />
          </motion.div>

          <ChartCard
            eyebrow="Composición"
            title="Peso de los tres grandes grupos"
            description="Porcentaje que cada grupo representa sobre el gasto total"
          >
            {categories.length === 0 ? (
              <EmptyChart height={140} compact message="Sin gastos en el periodo" />
            ) : (
              <>
                <div className="h-12 flex rounded-xl overflow-hidden mb-4">
                  {kpis.operativeRatio > 0 && (
                    <SegmentBar width={kpis.operativeRatio} color={CHART_SEMANTIC.operativo} label="Operativos" />
                  )}
                  {kpis.obligationsRatio > 0 && (
                    <SegmentBar width={kpis.obligationsRatio} color={CHART_SEMANTIC.obligaciones} label="Obligaciones" />
                  )}
                  {kpis.otherRatio > 0 && (
                    <SegmentBar width={kpis.otherRatio} color={CHART_SEMANTIC.otros} label="Otros" />
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <GroupLegendCard color={CHART_SEMANTIC.operativo} label="Operativos" amount={kpis.operativeCost} ratio={kpis.operativeRatio} />
                  <GroupLegendCard color={CHART_SEMANTIC.obligaciones} label="Obligaciones" amount={kpis.obligationsCost} ratio={kpis.obligationsRatio} />
                  <GroupLegendCard color={CHART_SEMANTIC.otros} label="Otros Gastos" amount={kpis.otherCost} ratio={kpis.otherRatio} />
                </div>
              </>
            )}
          </ChartCard>

          <ChartCard eyebrow="Detalle" title="Peso por rubro individual">
            {categories.length === 0 ? (
              <EmptyChart height={140} compact />
            ) : (
              <>
                <div className="h-10 flex rounded-lg overflow-hidden mb-4">
                  {categories.map((cat) => (
                    <div
                      key={cat.category}
                      className="h-full transition-all duration-700 relative"
                      style={{ width: `${Math.max(cat.percentage, 0.5)}%`, backgroundColor: cat.color || CHART_SEMANTIC.neutral }}
                      title={`${cat.category}: ${cat.percentage.toFixed(1)}%`}
                    >
                      {cat.percentage >= 8 && (
                        <span className="absolute inset-0 flex items-center justify-center text-caption font-medium text-surface truncate px-1">
                          {cat.percentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {categories.map((cat) => (
                    <div key={cat.category} className="flex items-center gap-2 text-caption">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || CHART_SEMANTIC.neutral }} />
                      <span className="text-graphite">{cat.category}</span>
                      <span className="text-mid-gray tabular-nums">{cat.percentage.toFixed(1)}%</span>
                      <span className="text-dark-graphite font-medium tabular-nums">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ChartCard>

          <ChartCard eyebrow="Evolución" title="Evolución mensual por categoría">
            {monthlyCosts.length === 0 ? (
              <EmptyChart height={300} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyCosts} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} vertical={false} />
                  <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={54} />
                  <Tooltip content={<ChartTooltip />} />
                  {categoryNames.map((name, i) => (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      name={name}
                      stackId="1"
                      stroke={categories.find((c) => c.category === name)?.color || paletteColor(i)}
                      fill={categories.find((c) => c.category === name)?.color || paletteColor(i)}
                      fillOpacity={0.35}
                      strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard eyebrow="Resumen" title="Tabla por categoría">
            {categories.length === 0 ? (
              <EmptyChart height={100} compact />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">Categoría</th>
                      <th className="text-left py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">Tipo</th>
                      <th className="text-right py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">Monto</th>
                      <th className="text-right py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">% del Total</th>
                      <th className="py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium w-36">Proporción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operativeCategories.length > 0 && (
                      <GroupSection label="Operativos" color={CHART_SEMANTIC.operativo} rows={operativeCategories} />
                    )}
                    {obligationCategories.length > 0 && (
                      <GroupSection label="Obligaciones" color={CHART_SEMANTIC.obligaciones} rows={obligationCategories} />
                    )}
                    {otherCategories.length > 0 && (
                      <GroupSection label="Otros Gastos" color={CHART_SEMANTIC.otros} rows={otherCategories} />
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </PageTransition>
  )
}

function SegmentBar({ width, color, label }: { width: number; color: string; label: string }) {
  return (
    <div
      className="h-full relative transition-all duration-700"
      style={{ width: `${width}%`, backgroundColor: color }}
    >
      {width >= 12 && (
        <span className="absolute inset-0 flex items-center justify-center text-caption font-medium text-surface">
          {label} {width.toFixed(0)}%
        </span>
      )}
    </div>
  )
}

function GroupLegendCard({ color, label, amount, ratio }: { color: string; label: string; amount: number; ratio: number }) {
  return (
    <div className="rounded-xl border border-border bg-bone/40 px-3.5 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-caption text-graphite font-medium">{label}</span>
        <span className="text-caption text-mid-gray ml-auto tabular-nums">{ratio.toFixed(1)}%</span>
      </div>
      <div className="text-body font-semibold text-dark-graphite tabular-nums">{formatCurrency(amount)}</div>
    </div>
  )
}

function GroupSection({ label, color, rows }: { label: string; color: string; rows: CategoryCost[] }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="pt-4 pb-1.5 px-3">
          <span className="text-caption font-semibold uppercase tracking-wider" style={{ color }}>
            {label}
          </span>
        </td>
      </tr>
      {rows.map((cat) => (
        <CategoryRow key={cat.category} cat={cat} />
      ))}
    </>
  )
}

function CategoryRow({ cat }: { cat: CategoryCost }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color || CHART_SEMANTIC.neutral }} />
          <span className="text-dark-graphite">{cat.category}</span>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${GROUP_BADGE_STYLES[cat.group]}`}>
          {cat.groupLabel}
        </span>
      </td>
      <td className="py-3 px-3 text-right font-medium text-dark-graphite tabular-nums">{formatCurrency(cat.amount)}</td>
      <td className="py-3 px-3 text-right text-graphite tabular-nums">{cat.percentage.toFixed(1)}%</td>
      <td className="py-3 px-3">
        <div className="h-2 bg-bone rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || CHART_SEMANTIC.neutral }}
          />
        </div>
      </td>
    </tr>
  )
}
