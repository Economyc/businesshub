import { useRef } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, RefreshCw, Scale, ShieldCheck, PackageOpen } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { AnalyticsTabs } from './analytics-tabs'
import { ExportPDF } from './export-pdf'
import { useCostStructure } from '../hooks'
import type { CostGroup } from '../types'

const AREA_COLORS = ['#5a7a5a', '#9a6a6a', '#6a7a9a', '#9a8a5a', '#7a5a8a', '#5a9a8a', '#8a6a5a', '#6a8a5a', '#5a6a9a', '#9a5a7a']

const GROUP_BADGE_STYLES: Record<CostGroup, string> = {
  operativo: 'bg-[#5a7a5a]/10 text-[#5a7a5a]',
  obligaciones: 'bg-[#9a8a5a]/10 text-[#9a8a5a]',
  otros: 'bg-[#8a8a8a]/10 text-[#6a6a6a]',
}

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

  // Group categories by type for the grouped table
  const operativeCategories = categories.filter((c) => c.group === 'operativo')
  const obligationCategories = categories.filter((c) => c.group === 'obligaciones')
  const otherCategories = categories.filter((c) => c.group === 'otros')

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
            <KPICard label="Gasto Total" value={kpis.totalCost} format="currency" change={kpis.totalChange} trend={kpis.totalChange.startsWith('+') ? 'up' : 'down'} icon={DollarSign} />
            <KPICard label="Operativos" value={kpis.operativeCost} format="currency" change={kpis.operativeChange} trend={kpis.operativeChange.startsWith('+') ? 'up' : 'down'} icon={RefreshCw} />
            <KPICard label="Obligaciones" value={kpis.obligationsCost} format="currency" change={kpis.obligationsChange} trend={kpis.obligationsChange.startsWith('+') ? 'up' : 'down'} icon={ShieldCheck} />
            <KPICard label="Otros Gastos" value={kpis.otherCost} format="currency" change={kpis.otherChange} trend={kpis.otherChange.startsWith('+') ? 'up' : 'down'} icon={PackageOpen} />
          </motion.div>

          {/* Composition summary — 3 groups */}
          <div className="bg-surface rounded-xl card-elevated p-6">
            <h2 className="text-subheading font-medium text-dark-graphite mb-4">Composición del Gasto</h2>
            {categories.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-mid-gray text-caption">Sin datos en este período</div>
            ) : (
              <>
                {/* 3-segment bar */}
                <div className="h-10 flex rounded-lg overflow-hidden mb-4">
                  {kpis.operativeRatio > 0 && (
                    <div className="h-full bg-[#5a7a5a] relative transition-all duration-700" style={{ width: `${kpis.operativeRatio}%` }}>
                      {kpis.operativeRatio >= 12 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white/90">
                          Operativos {kpis.operativeRatio.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                  {kpis.obligationsRatio > 0 && (
                    <div className="h-full bg-[#9a8a5a] relative transition-all duration-700" style={{ width: `${kpis.obligationsRatio}%` }}>
                      {kpis.obligationsRatio >= 12 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white/90">
                          Obligaciones {kpis.obligationsRatio.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                  {kpis.otherRatio > 0 && (
                    <div className="h-full bg-[#8a8a8a] relative transition-all duration-700" style={{ width: `${kpis.otherRatio}%` }}>
                      {kpis.otherRatio >= 12 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white/90">
                          Otros {kpis.otherRatio.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 text-caption">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5a7a5a] shrink-0" />
                    <span className="text-graphite">Operativos</span>
                    <span className="text-mid-gray">{kpis.operativeRatio.toFixed(1)}%</span>
                    <span className="text-dark-graphite font-medium">{formatCurrency(kpis.operativeCost)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-caption">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#9a8a5a] shrink-0" />
                    <span className="text-graphite">Obligaciones</span>
                    <span className="text-mid-gray">{kpis.obligationsRatio.toFixed(1)}%</span>
                    <span className="text-dark-graphite font-medium">{formatCurrency(kpis.obligationsCost)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-caption">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8a8a8a] shrink-0" />
                    <span className="text-graphite">Otros Gastos</span>
                    <span className="text-mid-gray">{kpis.otherRatio.toFixed(1)}%</span>
                    <span className="text-dark-graphite font-medium">{formatCurrency(kpis.otherCost)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Detail by category within each group */}
          <div className="bg-surface rounded-xl card-elevated p-6">
            <h2 className="text-subheading font-medium text-dark-graphite mb-4">Peso de Cada Rubro</h2>
            {categories.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-mid-gray text-caption">Sin datos en este período</div>
            ) : (
              <>
                {/* Stacked percentage bar by individual category */}
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

          {/* Summary Table — grouped by cost type */}
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
                      <th className="text-left py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">Tipo</th>
                      <th className="text-right py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">Monto</th>
                      <th className="text-right py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium">% del Total</th>
                      <th className="py-2.5 px-3 text-caption uppercase tracking-wider text-mid-gray font-medium w-36">Proporción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operativeCategories.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="pt-4 pb-1.5 px-3">
                            <span className="text-caption font-semibold uppercase tracking-wider text-[#5a7a5a]">Operativos</span>
                          </td>
                        </tr>
                        {operativeCategories.map((cat) => (
                          <CategoryRow key={cat.category} cat={cat} />
                        ))}
                      </>
                    )}
                    {obligationCategories.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="pt-4 pb-1.5 px-3">
                            <span className="text-caption font-semibold uppercase tracking-wider text-[#9a8a5a]">Obligaciones</span>
                          </td>
                        </tr>
                        {obligationCategories.map((cat) => (
                          <CategoryRow key={cat.category} cat={cat} />
                        ))}
                      </>
                    )}
                    {otherCategories.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="pt-4 pb-1.5 px-3">
                            <span className="text-caption font-semibold uppercase tracking-wider text-[#6a6a6a]">Otros Gastos</span>
                          </td>
                        </tr>
                        {otherCategories.map((cat) => (
                          <CategoryRow key={cat.category} cat={cat} />
                        ))}
                      </>
                    )}
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

function CategoryRow({ cat }: { cat: import('../types').CategoryCost }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#8a8a8a' }} />
          <span className="text-dark-graphite">{cat.category}</span>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${GROUP_BADGE_STYLES[cat.group]}`}>
          {cat.groupLabel}
        </span>
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
  )
}
