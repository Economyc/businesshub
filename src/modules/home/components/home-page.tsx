import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { SyncStatusDot } from '@/core/ui/sync-status-dot'
import { useAuth } from '@/core/hooks/use-auth'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { useDashboardData } from '../hooks'
import type { DashboardKPIs, SalesTrendPoint, DashboardAlerts, CajaBreakdown } from '../hooks'
import { useHomeFilters, HomeFiltersProvider } from '../context/home-filters-context'
import { KPICardsRow } from './kpi-cards-row'
import { SalesTrendChart } from './sales-trend-chart'
import { AlertsPanel } from './alerts-panel'
import { QuickActions } from './quick-actions'
import { CajaFilter } from './caja-filter'
import { CajaBreakdownCard } from './caja-breakdown-card'

interface DashboardContentProps {
  kpis: DashboardKPIs
  salesTrend: SalesTrendPoint[]
  alerts: DashboardAlerts
  periodLabel: string
  startDate: Date
  endDate: Date
  cajaBreakdown: CajaBreakdown | null
}

function DashboardContent({ kpis, salesTrend, alerts, periodLabel, startDate, endDate, cajaBreakdown }: DashboardContentProps) {
  const { selectedCaja } = useHomeFilters()
  return (
    <div className="space-y-6">
      <KPICardsRow kpis={kpis} periodLabel={periodLabel} />
      {cajaBreakdown && selectedCaja !== 'todas' && (
        <CajaBreakdownCard cajaId={selectedCaja} breakdown={cajaBreakdown} periodLabel={periodLabel} />
      )}
      <SalesTrendChart data={salesTrend} startDate={startDate} endDate={endDate} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertsPanel alerts={alerts} />
        <QuickActions />
      </div>
    </div>
  )
}

function HomePageContent() {
  const { user } = useAuth()
  const { presetLabel, startDate, endDate } = useDateRange()
  const { kpis, salesTrend, alerts, loading, syncStatus, cajasDisponibles, cajaBreakdown } = useDashboardData()

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
            <CajaFilter cajas={cajasDisponibles} />
            <DateRangePicker />
          </div>
        </div>
      </div>
      {/* Desktop PageHeader */}
      <div className="hidden sm:block">
        <PageHeader title="Dashboard">
          <div className="flex items-center gap-2">
            <SyncStatusDot {...syncStatus} />
            <CajaFilter cajas={cajasDisponibles} />
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
          startDate={startDate}
          endDate={endDate}
          cajaBreakdown={cajaBreakdown}
        />
      )}
    </PageTransition>
  )
}

export function HomePage() {
  return (
    <HomeFiltersProvider>
      <HomePageContent />
    </HomeFiltersProvider>
  )
}
