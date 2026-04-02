import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Hash, Receipt, Truck } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
  Cell,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { AnalyticsTabs } from './analytics-tabs'
import { ExportPDF } from './export-pdf'
import { usePurchaseAnalytics } from '../hooks'

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.fill || entry.stroke }} className="text-dark-graphite">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      <p className="text-dark-graphite">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function PurchasesDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, suppliers, products, monthlyPurchases, loading } = usePurchaseAnalytics()

  const supplierChartHeight = Math.max(200, suppliers.length * 48)

  return (
    <PageTransition>
      <PageHeader title="Análisis">
        <DateRangePicker />
        <ExportPDF targetRef={dashboardRef} />
      </PageHeader>
      <AnalyticsTabs />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-mid-gray text-caption animate-pulse">Cargando datos...</span>
        </div>
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          {/* KPI Cards */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <KPICard label="Total Compras" value={kpis.totalPurchases} format="currency" change={kpis.totalChange} trend={kpis.totalChange.startsWith('+') ? 'up' : 'down'} icon={ShoppingCart} />
            <KPICard label="# Órdenes" value={kpis.orderCount} format="number" change={kpis.orderChange} trend={kpis.orderChange.startsWith('+') ? 'up' : 'down'} icon={Hash} />
            <KPICard label="Ticket Promedio" value={kpis.avgTicket} format="currency" change={kpis.ticketChange} trend={kpis.ticketChange.startsWith('+') ? 'up' : 'down'} icon={Receipt} />
            <KPICard label="Proveedores" value={kpis.activeSuppliers} format="number" change={kpis.supplierChange} trend="up" icon={Truck} />
          </motion.div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Purchase Trend */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Tendencia de Compras</h2>
              {monthlyPurchases.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-mid-gray text-caption">Sin datos en este período</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyPurchases} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} width={54} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="purchases"
                      name="Compras"
                      stroke="#6a7a9a"
                      fill="#6a7a9a"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#6a7a9a' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Products */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Productos Más Comprados</h2>
              {products.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-mid-gray text-caption">Sin datos en este período</div>
              ) : (
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto">
                  {products.map((p, i) => {
                    const maxTotal = products[0]?.total || 1
                    const pct = (p.total / maxTotal) * 100
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-caption text-mid-gray w-5 text-right shrink-0">{i + 1}</span>
                        <span className="text-body text-graphite w-36 truncate shrink-0">{p.name}</span>
                        <div className="flex-1 h-6 bg-bone rounded-md overflow-hidden">
                          <div
                            className="h-full rounded-md transition-all duration-500 bg-[#6a7a9a]/60"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                        <span className="text-body font-medium text-dark-graphite w-24 text-right shrink-0">{formatCurrency(p.total)}</span>
                        <span className="text-caption text-mid-gray w-16 text-right shrink-0">{p.quantity} uds</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Purchases by Supplier */}
          <div className="bg-surface rounded-xl card-elevated p-6">
            <h2 className="text-subheading font-medium text-dark-graphite mb-4">Compras por Proveedor</h2>
            {suppliers.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-mid-gray text-caption">Sin datos en este período</div>
            ) : (
              <ResponsiveContainer width="100%" height={supplierChartHeight}>
                <BarChart
                  data={suppliers}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid horizontal vertical={false} strokeDasharray="3 3" stroke="#eeece9" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: '#f5f4f2' }} />
                  <Bar dataKey="total" name="Total" fill="#6a7a9a" barSize={20} radius={[0, 6, 6, 0]}>
                    {suppliers.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#5a6a8a' : '#6a7a9a'} opacity={1 - i * 0.06} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  )
}
