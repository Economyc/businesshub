import { lazy, Suspense } from 'react'
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { Skeleton } from '@/core/ui/skeleton'
import { SyncStatusDot } from '@/core/ui/sync-status-dot'
import { useAuth } from '@/core/hooks/use-auth'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { useDashboardData } from '../hooks'
import type { DashboardSyncStatus } from '../hooks'
import { HomeFiltersProvider } from '../context/home-filters-context'
import { KPICardsRow } from './kpi-cards-row'
import { QuickActions } from './quick-actions'
import { CajaFilter } from './caja-filter'

// Lazy-load de componentes pesados: SalesTrendChart arrastra recharts (~400KB
// gzipped), AlertsPanel y MonthProjectionTile dependen de motion/radix. Los
// KPIs aparecen primero y el usuario puede verlos antes de que terminen de
// descargar estos chunks. Fallback: los mismos skeletons que ya usa el Home
// durante la carga de datos — no hay flash visual.
const SalesTrendChart = lazy(() =>
  import('./sales-trend-chart').then((m) => ({ default: m.SalesTrendChart })),
)
const MonthProjectionTile = lazy(() =>
  import('./month-projection-tile').then((m) => ({ default: m.MonthProjectionTile })),
)
const AlertsPanel = lazy(() =>
  import('./alerts-panel').then((m) => ({ default: m.AlertsPanel })),
)

const CACHE_STALE_MS = 2 * 60 * 60 * 1000 // 2 horas

function PosCacheStaleBanner({ syncStatus }: { syncStatus: DashboardSyncStatus }) {
  const { fromCache, lastUpdated, loading, hasLocals, onRefresh } = syncStatus
  if (!hasLocals || !fromCache || !lastUpdated) return null
  const ageMs = Date.now() - lastUpdated.getTime()
  if (ageMs < CACHE_STALE_MS) return null
  const hours = Math.floor(ageMs / (60 * 60 * 1000))
  const ageLabel = hours >= 24 ? `${Math.floor(hours / 24)} día(s)` : `${hours}h`
  return (
    <div className="bg-warning-bg text-warning-text rounded-xl px-4 py-3 text-body mb-4 flex items-center justify-between gap-3">
      <span>
        Los datos de POS tienen {ageLabel}. El total puede no incluir ventas recientes.
      </span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-caption font-medium hover:underline disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sincronizar con POS
        </button>
      )}
    </div>
  )
}

// Banner rojo cuando el fetch de POS se quedó corto vs el previo. A diferencia
// del stale banner (datos viejos pero íntegros), aquí los datos mostrados son
// potencialmente incompletos porque algún chunk falló. El CTA fuerza un
// refetch limpio ignorando cache local para recalcular desde cero.
function PosDegradedBanner({ syncStatus }: { syncStatus: DashboardSyncStatus }) {
  const { degraded, loading, onRefresh, hasLocals } = syncStatus
  if (!hasLocals || !degraded) return null
  return (
    <div className="bg-negative-bg text-negative-text rounded-xl px-4 py-3 text-body mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="shrink-0" />
        <span>
          La última sincronización con POS quedó incompleta. Los totales pueden no reflejar la realidad — intenta de nuevo.
        </span>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 text-caption font-medium hover:underline disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Reintentar
        </button>
      )}
    </div>
  )
}

function SalesTrendSkeleton() {
  return (
    <div className="bg-surface rounded-xl card-elevated p-6">
      <Skeleton className="h-5 w-40 rounded mb-4" />
      <Skeleton className="h-[220px] w-full rounded-lg" />
    </div>
  )
}

function AlertsSkeleton() {
  return (
    <div className="bg-surface rounded-xl card-elevated p-5 space-y-3">
      <Skeleton className="h-4 w-32 rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

function HomePageContent() {
  const { user } = useAuth()
  const { presetLabel, startDate, endDate } = useDateRange()
  const {
    kpis,
    salesTrend,
    alerts,
    ventasLoading,
    gastosLoading,
    costoLoading,
    porCobrarLoading,
    chartLoading,
    alertsLoading,
    syncStatus,
    cajasDisponibles,
    comparisonLabel,
    reconcilingHistoric,
    reconcileError,
    retryReconcile,
    lastCronRun,
    projection,
  } = useDashboardData()

  const firstName = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Usuario'
  const todayLabel = new Date().toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' })

  return (
    <PageTransition>
      {/* Mobile greeting header */}
      <div className="sm:hidden mb-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-heading font-medium text-dark-graphite tracking-tight">
              Hola, {firstName}
            </h1>
            <p className="text-body text-mid-gray mt-0.5">{todayLabel}</p>
          </div>
          <div className="pt-2 shrink-0">
            <SyncStatusDot {...syncStatus} />
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4">
          <CajaFilter cajas={cajasDisponibles} />
          <DateRangePicker />
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
      <PosDegradedBanner syncStatus={syncStatus} />
      <PosCacheStaleBanner syncStatus={syncStatus} />
      {reconcilingHistoric && (
        <div className="bg-info-bg text-info-text rounded-xl px-4 py-3 text-body mb-4 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          <span>
            Rellenando históricos del POS para este rango — puede tardar unos minutos. Los datos se actualizarán solos cuando termine.
          </span>
        </div>
      )}
      {reconcileError && !reconcilingHistoric && (
        <div className="bg-negative-bg text-negative-text rounded-xl px-4 py-3 text-body mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div>No se pudieron cargar los históricos del POS.</div>
              <div className="text-caption mt-1 opacity-80">{reconcileError}</div>
            </div>
          </div>
          {retryReconcile && (
            <button
              type="button"
              onClick={retryReconcile}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-negative-text/30 px-3 py-1.5 text-caption hover:bg-negative-text/10 transition"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          )}
        </div>
      )}
      {lastCronRun && !reconcilingHistoric && !reconcileError && (
        <div className="text-caption text-mid-gray mb-4">
          Reconcile nocturno {lastCronRun.date} ·{' '}
          {lastCronRun.hadErrors ? (
            <span className="text-warning-text">con errores</span>
          ) : (
            <span className="text-positive-text">
              {lastCronRun.ventasWritten.toLocaleString('es-CO')} ventas escritas
            </span>
          )}
        </div>
      )}
      <div className="space-y-6">
        <KPICardsRow
          kpis={kpis}
          periodLabel={presetLabel}
          comparisonLabel={comparisonLabel}
          ventasLoading={ventasLoading}
          gastosLoading={gastosLoading}
          costoLoading={costoLoading}
          porCobrarLoading={porCobrarLoading}
        />
        {!chartLoading && projection.applicable && (
          <Suspense fallback={<SalesTrendSkeleton />}>
            <MonthProjectionTile projection={projection} />
          </Suspense>
        )}
        {chartLoading ? (
          <SalesTrendSkeleton />
        ) : (
          <Suspense fallback={<SalesTrendSkeleton />}>
            <SalesTrendChart
              data={salesTrend}
              startDate={startDate}
              endDate={endDate}
              projection={projection.applicable ? projection.futurePoints : undefined}
            />
          </Suspense>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {alertsLoading ? (
            <AlertsSkeleton />
          ) : (
            <Suspense fallback={<AlertsSkeleton />}>
              <AlertsPanel alerts={alerts} />
            </Suspense>
          )}
          <QuickActions />
        </div>
      </div>
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
