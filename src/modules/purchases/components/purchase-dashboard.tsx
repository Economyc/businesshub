import { useState } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, ShoppingCart, TrendingUp, Package, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer, staggerItem } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { usePurchaseSummary, usePurchaseTrends, usePurchaseAlerts } from '../hooks'
import { FinanceTabs } from '@/modules/finance/components/finance-tabs'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'

const COLORS = ['#3d3d3d', '#5a7a5a', '#9a6a6a', '#6a6a9a', '#9a8a5a', '#5a8a8a', '#8a5a7a', '#7a7a5a']

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
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite">{payload[0].name}</p>
      <p className="text-graphite">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function PurchaseDashboard() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  const { summary, loading: summaryLoading } = usePurchaseSummary(month, year)
  const { trends, loading: trendsLoading } = usePurchaseTrends(12)
  const { alerts } = usePurchaseAlerts()

  const loading = summaryLoading || trendsLoading

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  function handlePrevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  function handleNextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const pieData = summary.bySupplier.slice(0, 6).map((s, i) => ({
    name: s.name,
    value: s.total,
    fill: COLORS[i % COLORS.length],
  }))

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <DateRangePicker />
      </PageHeader>
      <FinanceTabs />

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handlePrevMonth}
          className="px-3 py-1.5 rounded-lg border border-input-border text-body text-graphite hover:bg-bone transition-colors"
        >
          ←
        </button>
        <h2 className="text-subheading font-semibold text-dark-graphite">
          {monthNames[month]} {year}
        </h2>
        <button
          onClick={handleNextMonth}
          className="px-3 py-1.5 rounded-lg border border-input-border text-body text-graphite hover:bg-bone transition-colors"
        >
          →
        </button>
      </div>

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : (
        <>
          {/* KPIs */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-4 gap-4 mb-6"
          >
            <KPICard
              label="Total Compras"
              value={summary.totalMonth}
              format="currency"
              change={summary.changePercent !== 0 ? `${summary.changePercent > 0 ? '+' : ''}${summary.changePercent.toFixed(1)}% vs mes anterior` : undefined}
              trend={summary.changePercent >= 0 ? 'up' : 'down'}
              icon={DollarSign}
            />
            <KPICard
              label="# Compras"
              value={summary.purchaseCount}
              format="number"
              icon={ShoppingCart}
            />
            <motion.div variants={staggerItem} className="bg-surface rounded-xl p-[18px] card-elevated">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-caption uppercase tracking-wider text-mid-gray">Top Proveedor</span>
                <TrendingUp size={16} strokeWidth={1.5} className="text-smoke" />
              </div>
              <div className="text-body font-semibold text-dark-graphite truncate">
                {summary.topSupplier?.name ?? '—'}
              </div>
              {summary.topSupplier && (
                <div className="text-caption text-mid-gray mt-1">
                  {formatCurrency(summary.topSupplier.total)}
                </div>
              )}
            </motion.div>
            <motion.div variants={staggerItem} className="bg-surface rounded-xl p-[18px] card-elevated">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-caption uppercase tracking-wider text-mid-gray">Top Insumo</span>
                <Package size={16} strokeWidth={1.5} className="text-smoke" />
              </div>
              <div className="text-body font-semibold text-dark-graphite truncate">
                {summary.topProduct?.name ?? '—'}
              </div>
              {summary.topProduct && (
                <div className="text-caption text-mid-gray mt-1">
                  {formatCurrency(summary.topProduct.total)}
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* Trend Chart */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Tendencia de Compras</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trends} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#8a8a8a' }}
                    axisLine={false}
                    tickLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={{ fontSize: 11, fill: '#8a8a8a' }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total Compras"
                    stroke="#3d3d3d"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Supplier Distribution */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Compras por Proveedor</h2>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-body text-mid-gray">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-caption text-mid-gray">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                    {entry.name.length > 20 ? entry.name.slice(0, 20) + '...' : entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* Top Products Bar Chart */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Top 10 Insumos por Gasto</h2>
              {summary.topProducts.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-body text-mid-gray">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, summary.topProducts.length * 36)}>
                  <BarChart
                    data={summary.topProducts.map((p) => ({
                      name: p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name,
                      total: p.total,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid horizontal vertical={false} strokeDasharray="3 3" stroke="#eeece9" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 11, fill: '#8a8a8a' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 11, fill: '#8a8a8a' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f4f2' }} />
                    <Bar dataKey="total" name="Total" fill="#3d3d3d" barSize={18} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Alerts Panel */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">
                Alertas
                {alerts.length > 0 && (
                  <span className="ml-2 text-caption font-normal text-mid-gray">({alerts.length})</span>
                )}
              </h2>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-body text-mid-gray">
                  <AlertTriangle size={32} strokeWidth={1} className="mb-2 text-smoke" />
                  Sin alertas activas
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                        alert.severity === 'warning'
                          ? 'bg-warning-bg/50 border-warning-text/20'
                          : 'bg-bone/50 border-border'
                      }`}
                    >
                      {alert.type === 'price_increase' || alert.type === 'consumption_spike' ? (
                        <ArrowUpRight size={16} className="text-negative-text shrink-0 mt-0.5" />
                      ) : (
                        <ArrowDownRight size={16} className="text-positive-text shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-body font-medium text-dark-graphite truncate">{alert.productName}</p>
                        <p className="text-caption text-mid-gray">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Supplier Table */}
          {summary.bySupplier.length > 0 && (
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Desglose por Proveedor</h2>
              <table className="w-full text-body">
                <thead>
                  <tr className="text-caption uppercase tracking-wider text-mid-gray border-b border-border">
                    <th className="text-left py-2 pr-4">Proveedor</th>
                    <th className="text-right py-2 px-4"># Compras</th>
                    <th className="text-right py-2 pl-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySupplier.map((s, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 text-graphite font-medium">{s.name}</td>
                      <td className="py-2.5 px-4 text-right text-graphite">{s.count}</td>
                      <td className="py-2.5 pl-4 text-right font-medium text-graphite">{formatCurrency(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </PageTransition>
  )
}
