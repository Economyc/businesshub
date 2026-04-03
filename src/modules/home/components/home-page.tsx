import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { useCompany } from '@/core/hooks/use-company'
import { CompanyLogo } from '@/core/ui/company-logo'
import { useDashboardData } from '../hooks'
import { KPICardsRow } from './kpi-cards-row'
import { SalesTrendChart } from './sales-trend-chart'
import { AlertsPanel } from './alerts-panel'
import { QuickActions } from './quick-actions'

function DashboardContent() {
  const { kpis, salesTrend, alerts, loading } = useDashboardData()

  if (loading) return <DashboardSkeleton kpiCount={4} charts={1} />

  return (
    <div className="space-y-6">
      <KPICardsRow kpis={kpis} />
      <SalesTrendChart data={salesTrend} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertsPanel alerts={alerts} />
        <QuickActions />
      </div>
    </div>
  )
}

export function HomePage() {
  const { selectedCompany } = useCompany()

  return (
    <PageTransition>
      <PageHeader title="Dashboard">
        {selectedCompany && (
          <div className="flex items-center gap-2">
            <CompanyLogo company={selectedCompany} size="sm" />
            <span className="text-body text-graphite">{selectedCompany.name}</span>
          </div>
        )}
      </PageHeader>
      <DashboardContent />
    </PageTransition>
  )
}
