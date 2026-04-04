import { useRef } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, DollarSign, Percent, ShoppingCart } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { AnalyticsTabs } from './analytics-tabs'
import { ExportPDF } from './export-pdf'
import { useAnalyticsKPIs, useMonthlyBreakdown, useCategoryBreakdown } from '../hooks'

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.fill || entry.stroke }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite">{item.name}</p>
      <p className="text-dark-graphite">{formatCurrency(item.value)}</p>
      <p className="text-mid-gray">{item.payload.percentage?.toFixed(1)}%</p>
    </div>
  )
}

function ChartLegend({ payload }: any) {
  if (!payload?.length) return null
  return (
    <div className="flex gap-4 justify-center mt-2">
      {payload.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-caption text-mid-gray">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </div>
      ))}
    </div>
  )
}

export function GeneralDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, loading: kpiLoading } = useAnalyticsKPIs()
  const { data: monthly, loading: monthlyLoading } = useMonthlyBreakdown()
  const { categories, loading: catLoading } = useCategoryBreakdown()

  const loading = kpiLoading || monthlyLoading || catLoading
  const top5 = categories.slice(0, 5)

  return (
    <PageTransition>
      <PageHeader title="Análisis">
        <DateRangePicker />
        <ExportPDF targetRef={dashboardRef} />
      </PageHeader>
      <AnalyticsTabs />

      {loading ? (
        <DashboardSkeleton kpiCount={5} charts={2} />
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          {/* KPI Cards */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
          >
            <KPICard label="Ingresos" value={kpis.totalIncome} format="currency" change={kpis.incomeChange} trend={kpis.incomeChange.startsWith('+') ? 'up' : 'down'} icon={TrendingUp} />
            <KPICard label="Gastos" value={kpis.totalExpenses} format="currency" change={kpis.expenseChange} trend={kpis.expenseChange.startsWith('+') ? 'up' : 'down'} icon={TrendingDown} />
            <KPICard label="Utilidad Neta" value={kpis.netProfit} format="currency" change={kpis.profitChange} trend={kpis.netProfit >= 0 ? 'up' : 'down'} icon={DollarSign} />
            <KPICard label="Margen" value={Math.round(kpis.profitMargin)} format="number" change={kpis.marginChange} trend={kpis.profitMargin >= 0 ? 'up' : 'down'} icon={Percent} />
            <KPICard label="Compras" value={kpis.totalPurchases} format="currency" change={kpis.purchaseChange} trend={kpis.purchaseChange.startsWith('+') ? 'up' : 'down'} icon={ShoppingCart} />
          </motion.div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense Distribution Donut */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Distribución de Gastos</h2>
              {categories.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-mid-gray text-caption">Sin datos en este período</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {categories.map((entry, i) => (
                        <Cell key={i} fill={entry.color || '#8a8a8a'} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      content={() => (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-3">
                          {categories.map((c) => (
                            <div key={c.category} className="flex items-center gap-1.5 text-caption text-mid-gray">
                              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.color || '#8a8a8a' }} />
                              {c.category} {c.percentage.toFixed(0)}%
                            </div>
                          ))}
                        </div>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Income vs Expenses Bar Chart */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Ingresos vs Gastos</h2>
              {monthly.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-mid-gray text-caption">Sin datos en este período</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthly} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} width={54} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend content={<ChartLegend />} />
                    <Bar dataKey="income" name="Ingresos" fill="#5a7a5a" radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar dataKey="expenses" name="Gastos" fill="#9a6a6a" radius={[4, 4, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top 5 Categories */}
          <div className="bg-surface rounded-xl card-elevated p-6">
            <h2 className="text-subheading font-medium text-dark-graphite mb-4">Top 5 Categorías de Gasto</h2>
            {top5.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-mid-gray text-caption">Sin datos en este período</div>
            ) : (
              <div className="space-y-3">
                {top5.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#8a8a8a' }} />
                    <span className="text-body text-graphite w-20 sm:w-32 truncate">{cat.category}</span>
                    <div className="flex-1 h-7 bg-bone rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(cat.percentage, 2)}%`, backgroundColor: cat.color || '#8a8a8a', opacity: 0.7 }}
                      />
                    </div>
                    <span className="text-body font-medium text-dark-graphite w-16 sm:w-24 text-right">{formatCurrency(cat.amount)}</span>
                    <span className="text-caption text-mid-gray w-12 text-right">{cat.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  )
}
