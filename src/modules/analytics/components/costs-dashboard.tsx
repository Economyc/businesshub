import { useRef } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, Lock, Shuffle, Scale } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { AnalyticsTabs } from './analytics-tabs'
import { ExportPDF } from './export-pdf'
import { useCostStructure } from '../hooks'

const AREA_COLORS = ['#5a7a5a', '#9a6a6a', '#6a7a9a', '#9a8a5a', '#7a5a8a', '#5a9a8a', '#8a6a5a', '#6a8a5a', '#5a6a9a', '#9a5a7a']

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.stroke }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function CostsDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, categories, monthlyCosts, loading } = useCostStructure()

  // Get unique category names for stacked area chart
  const categoryNames = categories.map((c) => c.category)

  return (
    <PageTransition>
      <PageHeader title="Análisis">
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
            <KPICard label="Costo Total" value={kpis.totalCost} format="currency" change={kpis.totalChange} trend={kpis.totalChange.startsWith('+') ? 'up' : 'down'} icon={DollarSign} />
            <KPICard label="Costos Fijos" value={kpis.fixedCost} format="currency" change={kpis.fixedChange} trend={kpis.fixedChange.startsWith('+') ? 'up' : 'down'} icon={Lock} />
            <KPICard label="Costos Variables" value={kpis.variableCost} format="currency" change={kpis.variableChange} trend={kpis.variableChange.startsWith('+') ? 'up' : 'down'} icon={Shuffle} />
            <KPICard label="Ratio Fijo/Variable" value={Math.round(kpis.fixedRatio)} format="number" change={`${kpis.fixedRatio.toFixed(0)}% fijo / ${kpis.variableRatio.toFixed(0)}% variable`} trend="up" icon={Scale} />
          </motion.div>

          {/* Weight of each item — Stacked bar */}
          <div className="bg-surface rounded-xl card-elevated p-6">
            <h2 className="text-subheading font-medium text-dark-graphite mb-4">Peso de Cada Rubro</h2>
            {categories.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-mid-gray text-caption">Sin datos en este período</div>
            ) : (
              <>
                {/* Stacked percentage bar */}
                <div className="h-10 flex rounded-lg overflow-hidden mb-4">
                  {categories.map((cat) => (
                    <div
                      key={cat.category}
                      className="h-full transition-all duration-700 relative group"
                      style={{ width: `${Math.max(cat.percentage, 0.5)}%`, backgroundColor: cat.color || '#8a8a8a' }}
                      title={`${cat.category}: ${cat.percentage.toFixed(1)}%`}
                    >
                      {cat.percentage >= 8 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white/90 truncate px-1">
                          {cat.percentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {categories.map((cat) => (
                    <div key={cat.category} className="flex items-center gap-2 text-caption">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#8a8a8a' }} />
                      <span className="text-graphite">{cat.category}</span>
                      <span className="text-mid-gray">{cat.percentage.toFixed(1)}%</span>
                      <span className="text-dark-graphite font-medium">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Cost Evolution — Stacked Area Chart */}
          <div className="bg-surface rounded-xl card-elevated p-6">
            <h2 className="text-subheading font-medium text-dark-graphite mb-4">Evolución de Costos</h2>
            {monthlyCosts.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-mid-gray text-caption">Sin datos en este período</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyCosts} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} width={54} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    content={({ payload }: any) => (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                        {payload?.map((entry: any) => (
                          <div key={entry.value} className="flex items-center gap-1.5 text-caption text-mid-gray">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.value}
                          </div>
                        ))}
                      </div>
                    )}
                  />
                  {categoryNames.map((name, i) => (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      name={name}
                      stackId="1"
                      stroke={categories.find((c) => c.category === name)?.color || AREA_COLORS[i % AREA_COLORS.length]}
                      fill={categories.find((c) => c.category === name)?.color || AREA_COLORS[i % AREA_COLORS.length]}
                      fillOpacity={0.4}
                      strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Summary Table */}
          <div className="bg-surface rounded-xl card-elevated p-6">
            <h2 className="text-subheading font-medium text-dark-graphite mb-4">Resumen por Categoría</h2>
            {categories.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-mid-gray text-caption">Sin datos en este período</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">Categoría</th>
                      <th className="text-right py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">Monto</th>
                      <th className="text-right py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">% del Total</th>
                      <th className="py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium w-40">Proporción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.category} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#8a8a8a' }} />
                            <span className="text-dark-graphite">{cat.category}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-dark-graphite">{formatCurrency(cat.amount)}</td>
                        <td className="py-3 px-3 text-right text-graphite">{cat.percentage.toFixed(1)}%</td>
                        <td className="py-3 px-3">
                          <div className="h-2 bg-bone rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || '#8a8a8a' }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  )
}
