import { useRef } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, DollarSign, Percent, ShoppingCart } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { AnalyticsTabs } from './analytics-tabs'
import { ExportPDF } from './export-pdf'
import { AnalyticsHero } from './shared/analytics-hero'
import { ChartCard } from './shared/chart-card'
import { ChartTooltip } from './shared/chart-tooltip'
import { EmptyChart } from './shared/empty-chart'
import { KPIHero } from './shared/kpi-hero'
import { CHART_SEMANTIC, CHART_AXIS_TICK } from './shared/chart-theme'
import { useAnalyticsKPIs, useMonthlyBreakdown, useCategoryBreakdown } from '../hooks'

export function GeneralDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, loading: kpiLoading } = useAnalyticsKPIs()
  const { data: monthly, loading: monthlyLoading } = useMonthlyBreakdown()
  const { categories, loading: catLoading } = useCategoryBreakdown()

  const loading = kpiLoading || monthlyLoading || catLoading
  const top5 = categories.slice(0, 5)
  const profitSpark = monthly.map((m) => ({ value: (m.income ?? 0) - (m.expenses ?? 0) }))
  const profitTrend: 'up' | 'down' | 'neutral' =
    kpis.netProfit > 0 ? 'up' : kpis.netProfit < 0 ? 'down' : 'neutral'

  return (
    <PageTransition>
      <AnalyticsHero
        eyebrow="Análisis · General"
        title="Panorama financiero"
        description="Ingresos, gastos y utilidad con comparativa contra el periodo anterior."
        actions={<ExportPDF targetRef={dashboardRef} />}
      />
      <AnalyticsTabs />

      {loading ? (
        <DashboardSkeleton kpiCount={5} charts={2} />
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <KPIHero
                eyebrow="Indicador principal"
                label="Utilidad Neta"
                value={kpis.netProfit}
                change={kpis.profitChange}
                trend={profitTrend}
                icon={DollarSign}
                sparkline={profitSpark}
                sparkColor={kpis.netProfit >= 0 ? CHART_SEMANTIC.income : CHART_SEMANTIC.expense}
                caption={`Margen ${kpis.profitMargin.toFixed(1)}%`}
              />
            </div>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="lg:col-span-3 grid grid-cols-2 gap-4 content-start"
            >
              <KPICard label="Ingresos" value={kpis.totalIncome} format="currency" change={kpis.incomeChange} trend={kpis.incomeChange.startsWith('+') ? 'up' : 'down'} icon={TrendingUp} />
              <KPICard label="Gastos" value={kpis.totalExpenses} format="currency" change={kpis.expenseChange} trend={kpis.expenseChange.startsWith('+') ? 'down' : 'up'} icon={TrendingDown} />
              <KPICard label="Margen" value={Math.round(kpis.profitMargin)} format="percent" change={kpis.marginChange} trend={kpis.profitMargin >= 0 ? 'up' : 'down'} icon={Percent} />
              <KPICard label="Compras" value={kpis.totalPurchases} format="currency" change={kpis.purchaseChange} trend={kpis.purchaseChange.startsWith('+') ? 'up' : 'down'} icon={ShoppingCart} />
            </motion.div>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ChartCard eyebrow="Distribución" title="Gastos por categoría">
              {categories.length === 0 ? (
                <EmptyChart message="Sin gastos registrados" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={110}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {categories.map((entry, i) => (
                        <Cell key={i} fill={entry.color || CHART_SEMANTIC.neutral} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip variant="pie" />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
                  {categories.slice(0, 8).map((c) => (
                    <div key={c.category} className="flex items-center gap-1.5 text-caption text-mid-gray">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.color || CHART_SEMANTIC.neutral }} />
                      <span className="text-graphite">{c.category}</span>
                      <span>{c.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard eyebrow="Evolución" title="Ingresos vs Gastos">
              {monthly.length === 0 ? (
                <EmptyChart message="Sin movimientos en el periodo" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthly} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} vertical={false} />
                    <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={54} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f4f2' }} />
                    <Bar dataKey="income" name="Ingresos" fill={CHART_SEMANTIC.income} radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar dataKey="expenses" name="Gastos" fill={CHART_SEMANTIC.expense} radius={[4, 4, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex gap-4 justify-center mt-3">
                <LegendDot color={CHART_SEMANTIC.income} label="Ingresos" />
                <LegendDot color={CHART_SEMANTIC.expense} label="Gastos" />
              </div>
            </ChartCard>
          </motion.div>

          <ChartCard
            eyebrow="Top 5"
            title="Principales categorías de gasto"
            description="Ordenadas por monto total en el periodo seleccionado"
          >
            {top5.length === 0 ? (
              <EmptyChart height={140} compact message="Sin categorías con gasto" />
            ) : (
              <div className="space-y-3">
                {top5.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || CHART_SEMANTIC.neutral }} />
                    <span className="text-body text-graphite w-20 sm:w-32 truncate">{cat.category}</span>
                    <div className="flex-1 h-7 bg-bone rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(cat.percentage, 2)}%`, backgroundColor: cat.color || CHART_SEMANTIC.neutral, opacity: 0.75 }}
                      />
                    </div>
                    <span className="text-body font-medium text-dark-graphite w-16 sm:w-24 text-right tabular-nums">{formatCurrency(cat.amount)}</span>
                    <span className="text-caption text-mid-gray w-12 text-right tabular-nums">{cat.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </PageTransition>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-caption text-mid-gray">
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  )
}
