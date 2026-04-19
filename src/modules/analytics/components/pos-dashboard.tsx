import { useRef } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Percent,
  Coins,
  Receipt,
  Ticket,
  ShoppingCart,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
import {
  CHART_SEMANTIC,
  CHART_AXIS_TICK,
  paletteColor,
} from './shared/chart-theme'
import { usePosAnalytics } from '../hooks'

function pct(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

export function PosDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { totals, topCategories, topProducts, loading, hasLocales } =
    usePosAnalytics()

  const composition = [
    { name: 'Ventas netas', value: Math.max(totals.ventas - totals.impuestos, 0) },
    { name: 'Impuestos', value: totals.impuestos },
    { name: 'Propinas', value: totals.propinas },
    { name: 'Descuentos', value: totals.descuento },
  ].filter((slice) => slice.value > 0)

  const compositionTotal = composition.reduce((s, x) => s + x.value, 0)
  const compositionData = composition.map((slice) => ({
    ...slice,
    percentage: compositionTotal > 0 ? (slice.value / compositionTotal) * 100 : 0,
  }))

  const maxCategory = topCategories[0]?.amount ?? 0

  return (
    <PageTransition>
      <PageHeader title="Análisis">
        <DateRangePicker />
        <ExportPDF targetRef={dashboardRef} />
      </PageHeader>
      <AnalyticsTabs />

      {loading ? (
        <DashboardSkeleton kpiCount={6} charts={2} />
      ) : !hasLocales ? (
        <EmptyChart
          message="No hay locales POS configurados"
          hint="Configura un local en Punto de Venta para ver el análisis"
          height={320}
        />
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-6 gap-4"
          >
            <KPICard
              label="Ventas"
              value={totals.ventas}
              format="currency"
              icon={DollarSign}
            />
            <KPICard
              label="Descuentos"
              value={totals.descuento}
              format="currency"
              change={`${pct(totals.descuento, totals.ventas)} de ventas`}
              trend="neutral"
              icon={Percent}
            />
            <KPICard
              label="Propinas"
              value={totals.propinas}
              format="currency"
              change={`${pct(totals.propinas, totals.ventas)} de ventas`}
              trend="neutral"
              icon={Coins}
            />
            <KPICard
              label="Impuestos"
              value={totals.impuestos}
              format="currency"
              change={`${pct(totals.impuestos, totals.ventas)} de ventas`}
              trend="neutral"
              icon={Receipt}
            />
            <KPICard
              label="Ticket prom."
              value={totals.ticket}
              format="currency"
              icon={Ticket}
            />
            <KPICard
              label="Comprobantes"
              value={totals.count}
              format="number"
              icon={ShoppingCart}
            />
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ChartCard
              eyebrow="Composición"
              title="Desglose del ticket"
              description="Ventas netas vs impuestos, propinas y descuentos"
            >
              {compositionData.length === 0 ? (
                <EmptyChart message="Sin ventas en el periodo" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={compositionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={64}
                        outerRadius={110}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {compositionData.map((entry, i) => (
                          <Cell key={entry.name} fill={paletteColor(i)} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip variant="pie" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
                    {compositionData.map((slice, i) => (
                      <div
                        key={slice.name}
                        className="flex items-center gap-1.5 text-caption text-mid-gray"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: paletteColor(i) }}
                        />
                        <span className="text-graphite">{slice.name}</span>
                        <span>{slice.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>

            <ChartCard
              eyebrow="Top 5"
              title="Categorías con mayor venta"
              description="Suma de ítems vendidos por categoría"
            >
              {topCategories.length === 0 ? (
                <EmptyChart message="Sin ventas categorizadas" />
              ) : (
                <div className="space-y-3">
                  {topCategories.map((cat, i) => (
                    <div key={cat.category} className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: paletteColor(i) }}
                      />
                      <span className="text-body text-graphite w-20 sm:w-32 truncate">
                        {cat.category}
                      </span>
                      <div className="flex-1 h-7 bg-bone rounded-lg overflow-hidden relative">
                        <div
                          className="h-full rounded-lg transition-all duration-700 ease-out"
                          style={{
                            width: `${maxCategory > 0 ? Math.max((cat.amount / maxCategory) * 100, 2) : 2}%`,
                            backgroundColor: paletteColor(i),
                            opacity: 0.75,
                          }}
                        />
                      </div>
                      <span className="text-body font-medium text-dark-graphite w-20 sm:w-28 text-right tabular-nums">
                        {formatCurrency(cat.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </motion.div>

          <ChartCard
            eyebrow="Top 10"
            title="Productos más vendidos"
            description="Ranking por monto total de venta en el periodo"
          >
            {topProducts.length === 0 ? (
              <EmptyChart height={200} compact message="Sin productos vendidos" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(topProducts.length * 36, 240)}>
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_SEMANTIC.grid}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={CHART_AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={CHART_AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={140}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        variant="single"
                        extraLine={(p) =>
                          p?.quantity != null
                            ? `${Number(p.quantity).toLocaleString('es-CO')} unidades`
                            : null
                        }
                      />
                    }
                    cursor={{ fill: CHART_SEMANTIC.muted }}
                  />
                  <Bar
                    dataKey="amount"
                    name="Venta"
                    fill={CHART_SEMANTIC.income}
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}
    </PageTransition>
  )
}
