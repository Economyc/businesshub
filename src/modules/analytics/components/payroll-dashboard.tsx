import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Users, UserCheck, DollarSign, Percent } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
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
import { usePayrollAnalytics } from '../hooks'

const COLORS = ['#5a7a5a', '#9a6a6a', '#6a7a9a', '#9a8a5a', '#7a5a8a', '#5a9a8a', '#8a6a5a', '#6a8a5a']

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite">{item.name}</p>
      <p className="text-dark-graphite">{formatCurrency(item.value)}</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      <p className="text-dark-graphite">{formatCurrency(payload[0].value)}</p>
      {payload[0].payload?.count !== undefined && (
        <p className="text-mid-gray">{payload[0].payload.count} personas</p>
      )}
    </div>
  )
}

export function PayrollDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, departments, roles, loading } = usePayrollAnalytics()

  // Donut data: payroll vs rest of expenses
  const donutData = [
    { name: 'Nómina', value: kpis.totalPayroll },
    { name: 'Otros gastos', value: Math.max(0, (kpis.totalPayroll / (kpis.payrollToIncomeRatio / 100 || 1)) - kpis.totalPayroll) },
  ]

  const deptChartHeight = Math.max(200, departments.length * 52)
  const roleChartHeight = Math.max(200, roles.length * 52)

  return (
    <PageTransition>
      <PageHeader title="Análisis">
        <DateRangePicker />
        <ExportPDF targetRef={dashboardRef} />
      </PageHeader>
      <AnalyticsTabs />

      {loading ? (
        <DashboardSkeleton kpiCount={4} charts={2} />
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          {/* KPI Cards */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <KPICard label="Nómina Total" value={kpis.totalPayroll} format="currency" change={kpis.payrollChange} trend={kpis.payrollChange.startsWith('+') ? 'up' : 'down'} icon={DollarSign} />
            <KPICard label="Empleados" value={kpis.employeeCount} format="number" change={kpis.employeeChange} trend="up" icon={Users} />
            <KPICard label="Salario Promedio" value={kpis.avgSalary} format="currency" change={kpis.salaryChange} trend="up" icon={UserCheck} />
            <KPICard label="% de Ingresos" value={Math.round(kpis.payrollToIncomeRatio)} format="number" change={kpis.ratioChange} trend={kpis.payrollToIncomeRatio <= 40 ? 'up' : 'down'} icon={Percent} />
          </motion.div>

          {/* Donut + Department */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payroll Weight Donut */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Peso de la Nómina</h2>
              <div className="relative">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      <Cell fill="#9a6a6a" />
                      <Cell fill="#eeece9" />
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      content={() => (
                        <div className="flex gap-4 justify-center mt-3">
                          <div className="flex items-center gap-1.5 text-caption text-mid-gray">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#9a6a6a]" />
                            Nómina
                          </div>
                          <div className="flex items-center gap-1.5 text-caption text-mid-gray">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#eeece9]" />
                            Otros
                          </div>
                        </div>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center percentage */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '-20px' }}>
                  <div className="text-center">
                    <span className="text-[32px] font-bold text-dark-graphite">{kpis.payrollToIncomeRatio.toFixed(1)}%</span>
                    <p className="text-caption text-mid-gray">de ingresos</p>
                  </div>
                </div>
              </div>
            </div>

            {/* By Department */}
            <div className="bg-surface rounded-xl card-elevated p-6">
              <h2 className="text-subheading font-medium text-dark-graphite mb-4">Por Departamento</h2>
              {departments.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-mid-gray text-caption">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={deptChartHeight}>
                  <BarChart data={departments} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid horizontal vertical={false} strokeDasharray="3 3" stroke="#eeece9" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="department" width={120} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: '#f5f4f2' }} />
                    <Bar dataKey="total" name="Nómina" barSize={20} radius={[0, 6, 6, 0]}>
                      {departments.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* By Role */}
          <div className="bg-surface rounded-xl card-elevated p-6">
            <h2 className="text-subheading font-medium text-dark-graphite mb-4">Por Cargo</h2>
            {roles.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-mid-gray text-caption">Sin datos</div>
            ) : (
              <div className="space-y-2.5">
                {roles.map((r, i) => {
                  const maxTotal = roles[0]?.total || 1
                  const pct = (r.total / maxTotal) * 100
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-body text-graphite w-36 truncate shrink-0">{r.role}</span>
                      <div className="flex-1 h-7 bg-bone rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-500"
                          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: COLORS[i % COLORS.length], opacity: 0.6 }}
                        />
                      </div>
                      <span className="text-body font-medium text-dark-graphite w-28 text-right shrink-0">{formatCurrency(r.total)}</span>
                      <span className="text-caption text-mid-gray w-20 text-right shrink-0">{r.count} personas</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  )
}
