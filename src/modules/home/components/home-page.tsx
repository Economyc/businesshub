import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { CompanyLogo } from '@/core/ui/company-logo'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { useDashboardData } from '../hooks'
import { KPICardsRow } from './kpi-cards-row'
import { SalesTrendChart } from './sales-trend-chart'
import { AlertsPanel } from './alerts-panel'
import { QuickActions } from './quick-actions'

function DashboardContent() {
  const { kpis, salesTrend, alerts, loading } = useDashboardData()
  const { presetLabel } = useDateRange()

  if (loading) return <DashboardSkeleton kpiCount={4} charts={1} />

  return (
    <div className="space-y-6">
      <KPICardsRow kpis={kpis} periodLabel={presetLabel} />
      <SalesTrendChart data={salesTrend} periodLabel={presetLabel} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertsPanel alerts={alerts} />
        <QuickActions />
      </div>
    </div>
  )
}

export function HomePage() {
  const { selectedCompany } = useCompany()
  const { user } = useAuth()

  const firstName = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Usuario'
  const todayLabel = new Date().toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' })

  return (
    <PageTransition>
      {/* Mobile greeting header */}
      <div className="sm:hidden mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-dark-graphite tracking-tight">
              Hola, {firstName}
            </h1>
            <p className="text-sm text-mid-gray font-semibold mt-0.5">{todayLabel}</p>
          </div>
          <DateRangePicker />
        </div>
      </div>
      {/* Desktop PageHeader */}
      <div className="hidden sm:block">
        <PageHeader title="Dashboard">
          <div className="flex flex-wrap items-center gap-3">
            {selectedCompany && (
              <div className="flex items-center gap-2">
                <CompanyLogo company={selectedCompany} size="sm" />
                <span className="text-body text-graphite hidden sm:inline">{selectedCompany.name}</span>
              </div>
            )}
            <DateRangePicker />
          </div>
        </PageHeader>
      </div>
      <DashboardContent />
    </PageTransition>
  )
}
