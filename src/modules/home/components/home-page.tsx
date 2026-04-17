import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { SyncStatusDot } from '@/core/ui/sync-status-dot'
import { useAuth } from '@/core/hooks/use-auth'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { useDashboardData } from '../hooks'
import type { DashboardKPIs, SalesTrendPoint, DashboardAlerts } from '../hooks'
import { KPICardsRow } from './kpi-cards-row'
import { SalesTrendChart } from './sales-trend-chart'
import { AlertsPanel } from './alerts-panel'
import { QuickActions } from './quick-actions'

interface DashboardContentProps {
  kpis: DashboardKPIs
  salesTrend: SalesTrendPoint[]
  alerts: DashboardAlerts
  periodLabel: string
}

function DashboardContent({ kpis, salesTrend, alerts, periodLabel }: DashboardContentProps) {
  return (
    <div className="space-y-6">
      <KPICardsRow kpis={kpis} periodLabel={periodLabel} />
      <SalesTrendChart data={salesTrend} periodLabel={periodLabel} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertsPanel alerts={alerts} />
        <QuickActions />
      </div>
    </div>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const { presetLabel } = useDateRange()
  const { kpis, salesTrend, alerts, loading, syncStatus } = useDashboardData()

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
          <div className="flex items-center gap-2">
            <SyncStatusDot {...syncStatus} />
            <DateRangePicker />
          </div>
        </div>
      </div>
      {/* Desktop PageHeader */}
      <div className="hidden sm:block">
        <PageHeader title="Dashboard">
          <div className="flex items-center gap-2">
            <SyncStatusDot {...syncStatus} />
            <DateRangePicker />
          </div>
        </PageHeader>
      </div>
      {loading ? (
        <DashboardSkeleton kpiCount={4} charts={1} />
      ) : (
        <DashboardContent
          kpis={kpis}
          salesTrend={salesTrend}
          alerts={alerts}
          periodLabel={presetLabel}
        />
      )}
    </PageTransition>
  )
}
