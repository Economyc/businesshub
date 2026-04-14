import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Hash, Receipt, Truck } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
  Cell,
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
import { usePurchaseAnalytics } from '../hooks'

export function PurchasesDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, suppliers, products, monthlyPurchases, loading } = usePurchaseAnalytics()

  const supplierChartHeight = Math.max(200, suppliers.length * 48)
  const purchasesSpark = monthlyPurchases.map((m) => ({ value: m.purchases ?? 0 }))

  return (
    <PageTransition>
      <AnalyticsHero
        eyebrow="Análisis · Compras"
        title="Compras e insumos"
        description="Flujo de compras, ticket promedio y concentración por proveedor y producto."
        actions={<ExportPDF targetRef={dashboardRef} />}
      />
      <AnalyticsTabs />

      {loading ? (
        <DashboardSkeleton kpiCount={4} charts={2} />
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <KPIHero
                eyebrow="Indicador principal"
                label="Total en Compras"
                value={kpis.totalPurchases}
                change={kpis.totalChange}
                trend={kpis.totalChange.startsWith('+') ? 'up' : 'down'}
                icon={ShoppingCart}
                sparkline={purchasesSpark}
                sparkColor={CHART_SEMANTIC.purchases}
                caption={`${kpis.orderCount} órdenes · ${kpis.activeSuppliers} proveedores`}
              />
            </div>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start"
            >
              <KPICard label="# Órdenes" value={kpis.orderCount} format="number" change={kpis.orderChange} trend={kpis.orderChange.startsWith('+') ? 'up' : 'down'} icon={Hash} />
              <KPICard label="Ticket Promedio" value={kpis.avgTicket} format="currency" change={kpis.ticketChange} trend={kpis.ticketChange.startsWith('+') ? 'up' : 'down'} icon={Receipt} />
              <KPICard label="Proveedores" value={kpis.activeSuppliers} format="number" change={kpis.supplierChange} trend="up" icon={Truck} />
            </motion.div>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ChartCard eyebrow="Tendencia" title="Evolución mensual">
              {monthlyPurchases.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyPurchases} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="purchasesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_SEMANTIC.purchases} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CHART_SEMANTIC.purchases} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} vertical={false} />
                    <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={54} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="purchases"
                      name="Compras"
                      stroke={CHART_SEMANTIC.purchases}
                      fill="url(#purchasesGradient)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: CHART_SEMANTIC.purchases }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard eyebrow="Ranking" title="Productos más comprados">
              {products.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {products.map((p, i) => {
                    const maxTotal = products[0]?.total || 1
                    const pct = (p.total / maxTotal) * 100
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-caption text-mid-gray w-5 text-right shrink-0 tabular-nums">{i + 1}</span>
                        <span className="text-body text-graphite w-24 sm:w-36 truncate shrink-0">{p.name}</span>
                        <div className="flex-1 h-6 bg-bone rounded-md overflow-hidden">
                          <div
                            className="h-full rounded-md transition-all duration-500"
                            style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: CHART_SEMANTIC.purchases, opacity: 0.6 }}
                          />
                        </div>
                        <span className="text-body font-medium text-dark-graphite w-24 text-right shrink-0 tabular-nums">{formatCurrency(p.total)}</span>
                        <span className="text-caption text-mid-gray w-16 text-right shrink-0 tabular-nums">{p.quantity} uds</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </ChartCard>
          </motion.div>

          <ChartCard eyebrow="Concentración" title="Compras por proveedor">
            {suppliers.length === 0 ? (
              <EmptyChart height={140} compact />
            ) : (
              <ResponsiveContainer width="100%" height={supplierChartHeight}>
                <BarChart data={suppliers} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid horizontal vertical={false} strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip variant="single" />} cursor={{ fill: CHART_SEMANTIC.muted }} />
                  <Bar dataKey="total" name="Total" barSize={20} radius={[0, 6, 6, 0]}>
                    {suppliers.map((_, i) => (
                      <Cell key={i} fill={CHART_SEMANTIC.purchases} opacity={1 - i * 0.06} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}
    </PageTransition>
  )
}
