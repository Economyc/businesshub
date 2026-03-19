import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Users, Briefcase, DollarSign, BarChart3 } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { useKPIs, useTrends, useCategoryBreakdown } from '../hooks'
import { TrendChart } from './trend-chart'
import { CategoryBreakdown } from './category-breakdown'
import { ExportPDF } from './export-pdf'

export function KPIDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { kpis, loading: kpiLoading } = useKPIs()
  const { trends, loading: trendsLoading } = useTrends()
  const { categories, loading: catLoading } = useCategoryBreakdown()

  const loading = kpiLoading || trendsLoading || catLoading

  return (
    <PageTransition>
      <PageHeader title="Panel de Insights">
        <ExportPDF targetRef={dashboardRef} />
      </PageHeader>

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
            className="grid grid-cols-4 gap-4"
          >
            <KPICard
              label="Empleados"
              value={kpis.totalEmployees}
              format="number"
              change={kpis.employeeChange}
              trend="up"
              icon={Users}
            />
            <KPICard
              label="Proveedores"
              value={kpis.totalSuppliers}
              format="number"
              change={kpis.supplierChange}
              trend="up"
              icon={Briefcase}
            />
            <KPICard
              label="Gastos del Mes"
              value={kpis.totalExpenses}
              format="currency"
              change={kpis.expenseChange}
              trend={kpis.expenseChange.startsWith('+') ? 'up' : 'down'}
              icon={DollarSign}
            />
            <KPICard
              label="Balance"
              value={kpis.balance}
              format="currency"
              change={kpis.balanceChange}
              trend={kpis.balance >= 0 ? 'up' : 'down'}
              icon={BarChart3}
            />
          </motion.div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6">
            <TrendChart data={trends} />
            <CategoryBreakdown data={categories} />
          </div>
        </div>
      )}
    </PageTransition>
  )
}
