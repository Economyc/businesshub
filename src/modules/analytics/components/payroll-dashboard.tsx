import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Users, UserCheck, DollarSign, Percent } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { ExportPDF } from './export-pdf'
import { ChartCard } from './shared/chart-card'
import { ChartTooltip } from './shared/chart-tooltip'
import { EmptyChart } from './shared/empty-chart'
import { CHART_SEMANTIC, CHART_AXIS_TICK, paletteColor } from './shared/chart-theme'
import { usePayrollAnalytics } from '../hooks'

export function PayrollDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, departments, roles, loading } = usePayrollAnalytics()

  const donutData = [
    { name: 'Nómina', value: kpis.totalPayroll },
    { name: 'Otros gastos', value: Math.max(0, (kpis.totalPayroll / (kpis.payrollToIncomeRatio / 100 || 1)) - kpis.totalPayroll) },
  ]

  const deptChartHeight = Math.max(200, departments.length * 52)

  const ratioTrend: 'up' | 'down' | 'neutral' =
    kpis.payrollToIncomeRatio <= 30 ? 'up' : kpis.payrollToIncomeRatio <= 40 ? 'neutral' : 'down'

  return (
    <PageTransition>
      <PageHeader title="Análisis">
        <DateRangePicker />
        <ExportPDF targetRef={dashboardRef} />
      </PageHeader>

      {loading ? (
        <DashboardSkeleton kpiCount={4} charts={2} />
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <KPICard label="Nómina Total" value={kpis.totalPayroll} format="currency" change={kpis.payrollChange} trend={kpis.payrollChange.startsWith('+') ? 'down' : 'up'} icon={DollarSign} />
            <KPICard label="Empleados" value={kpis.employeeCount} format="number" change={kpis.employeeChange} trend="up" icon={Users} />
            <KPICard label="Salario Promedio" value={kpis.avgSalary} format="currency" change={kpis.salaryChange} trend="up" icon={UserCheck} />
            <KPICard label="% de Ingresos" value={Math.round(kpis.payrollToIncomeRatio)} format="percent" change={kpis.ratioChange} trend={ratioTrend} icon={Percent} />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard eyebrow="Peso relativo" title="Nómina sobre ingresos">
              <div className="relative">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={78}
                      outerRadius={114}
                      paddingAngle={3}
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      <Cell key="payroll" fill={CHART_SEMANTIC.payroll} />
                      <Cell key="muted" fill={CHART_SEMANTIC.muted} />
                    </Pie>
                    <Tooltip content={<ChartTooltip variant="pie" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '-20px' }}>
                  <div className="text-center">
                    <span className="text-kpi font-semibold text-dark-graphite tabular-nums">
                      {kpis.payrollToIncomeRatio.toFixed(1)}%
                    </span>
                    <p className="text-caption text-mid-gray mt-1">de ingresos</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 justify-center mt-2">
                <div className="flex items-center gap-1.5 text-caption text-mid-gray">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: CHART_SEMANTIC.payroll }} />
                  Nómina
                </div>
                <div className="flex items-center gap-1.5 text-caption text-mid-gray">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: CHART_SEMANTIC.muted }} />
                  Otros ingresos
                </div>
              </div>
            </ChartCard>

            <ChartCard eyebrow="Distribución" title="Nómina por departamento">
              {departments.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={deptChartHeight}>
                  <BarChart data={departments} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid horizontal vertical={false} strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="department" width={120} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={
                        <ChartTooltip
                          variant="single"
                          extraLine={(p) => (p?.count != null ? `${p.count} personas` : null)}
                        />
                      }
                      cursor={{ fill: CHART_SEMANTIC.muted }}
                    />
                    <Bar dataKey="total" name="Nómina" barSize={20} radius={[0, 6, 6, 0]} isAnimationActive={false}>
                      {departments.map((dept, i) => (
                        <Cell key={dept.department} fill={paletteColor(i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <ChartCard eyebrow="Por cargo" title="Concentración salarial por rol">
            {roles.length === 0 ? (
              <EmptyChart height={140} compact />
            ) : (
              <div className="space-y-2.5">
                {roles.map((r, i) => {
                  const maxTotal = roles[0]?.total || 1
                  const pct = (r.total / maxTotal) * 100
                  const color = paletteColor(i)
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-body text-graphite w-24 sm:w-36 truncate shrink-0">{r.role}</span>
                      <div className="flex-1 h-7 bg-bone rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-500"
                          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color, opacity: 0.65 }}
                        />
                      </div>
                      <span className="text-body font-medium text-dark-graphite w-28 text-right shrink-0 tabular-nums">{formatCurrency(r.total)}</span>
                      <span className="text-caption text-mid-gray w-20 text-right shrink-0 tabular-nums">{r.count} personas</span>
                    </div>
                  )
                })}
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </PageTransition>
  )
}
