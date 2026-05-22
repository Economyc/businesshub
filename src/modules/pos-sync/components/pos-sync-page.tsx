import { useState, useEffect, useMemo } from 'react'
import { ShoppingBag, Package, XCircle, Database } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { SyncStatusDot } from '@/core/ui/sync-status-dot'
import {
  PosHeroSkeleton,
  PosCompactHeroSkeleton,
  PosProductGridSkeleton,
  PosSummaryCardsSkeleton,
  Skeleton,
  TableSkeleton,
} from '@/core/ui/skeleton'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePermissions } from '@/core/hooks/use-permissions'
import { TAB_IDS } from '@/core/config/access-registry'
import { useCompanyLocalIds } from '../company-mapping'
import { VentasTab } from './ventas-tab'
import { CatalogoTab } from './catalogo-tab'
import { AnuladasTab } from './anuladas-tab'
import { CacheStatusTab } from './cache-status-tab'

const ALL_TABS = [
  { value: 'ventas', label: 'Ventas', icon: ShoppingBag, tabId: TAB_IDS.posVentas },
  { value: 'catalogo', label: 'Catálogo', icon: Package, tabId: TAB_IDS.posCatalogo },
  { value: 'anuladas', label: 'Anuladas', icon: XCircle, tabId: TAB_IDS.posAnuladas },
  { value: 'cache', label: 'Caché', icon: Database, tabId: TAB_IDS.posCache },
]

export function PosSyncPage() {
  const [activeTab, setActiveTab] = useState('ventas')
  const {
    locales,
    localIds: activeLocalIds,
    localLabel,
    localDisplayNames,
    loading: loadingLocales,
    error: localesError,
  } = useCompanyLocalIds()
  const { setPreset } = useDateRange()
  const { canAccessTab } = usePermissions()

  const tabs = useMemo(
    () => ALL_TABS.filter((t) => canAccessTab(t.tabId)),
    [canAccessTab],
  )

  useEffect(() => {
    setPreset('today')
    return () => { setPreset('thisMonth') }
  }, [setPreset])

  // Si el tab activo deja de ser visible, volver al primero disponible.
  useEffect(() => {
    if (!tabs.some((t) => t.value === activeTab)) setActiveTab(tabs[0]?.value ?? 'ventas')
  }, [tabs, activeTab])

  return (
    <PageTransition>
      <PageHeader title="Punto de Venta">
        <div className="flex items-center gap-3">
          <SyncStatusDot
            loading={loadingLocales}
            lastUpdated={loadingLocales || localesError ? null : new Date()}
            fromCache={false}
            hasLocals={!localesError}
          />
          <DateRangePicker />
        </div>
      </PageHeader>

      <UnderlineButtonTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {loadingLocales && activeTab !== 'cache' && <PosTabSkeleton tab={activeTab} />}

      {locales.length > 0 && activeTab === 'ventas' && (
        <VentasTab
          localIds={activeLocalIds}
          allLocalIds={activeLocalIds}
          locales={locales}
          localLabel={localLabel}
          localDisplayNames={localDisplayNames}
        />
      )}
      {locales.length > 0 && activeTab === 'catalogo' && (
        <CatalogoTab localId={activeLocalIds[0]} localLabel={localLabel} />
      )}
      {locales.length > 0 && activeTab === 'anuladas' && (
        <AnuladasTab
          localIds={activeLocalIds}
          allLocalIds={activeLocalIds}
          locales={locales}
          localLabel={localLabel}
          localDisplayNames={localDisplayNames}
        />
      )}
      {activeTab === 'cache' && canAccessTab(TAB_IDS.posCache) && <CacheStatusTab />}
    </PageTransition>
  )
}

function PosTabSkeleton({ tab }: { tab: string }) {
  if (tab === 'catalogo') {
    return (
      <div>
        <PosCompactHeroSkeleton />
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
          <Skeleton className="h-10 w-full sm:w-60 rounded-lg" />
        </div>
        <PosProductGridSkeleton />
      </div>
    )
  }
  if (tab === 'anuladas') {
    return (
      <div>
        <PosCompactHeroSkeleton />
        <TableSkeleton rows={4} columns={4} />
      </div>
    )
  }
  return (
    <div>
      <PosHeroSkeleton />
      <PosSummaryCardsSkeleton />
      <TableSkeleton rows={6} columns={6} />
    </div>
  )
}

