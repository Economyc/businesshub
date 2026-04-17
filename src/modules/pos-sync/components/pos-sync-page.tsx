import { useState, useEffect } from 'react'
import { ShoppingBag, Package, XCircle } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { SyncStatusDot } from '@/core/ui/sync-status-dot'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { useCompanyLocalIds } from '../company-mapping'
import { VentasTab } from './ventas-tab'
import { CatalogoTab } from './catalogo-tab'
import { AnuladasTab } from './anuladas-tab'

const TABS = [
  { value: 'ventas', label: 'Ventas', icon: ShoppingBag },
  { value: 'catalogo', label: 'Catálogo', icon: Package },
  { value: 'anuladas', label: 'Anuladas', icon: XCircle },
]

export function PosSyncPage() {
  const [activeTab, setActiveTab] = useState('ventas')
  const {
    locales,
    localIds: activeLocalIds,
    localLabel,
    loading: loadingLocales,
    error: localesError,
  } = useCompanyLocalIds()
  const { setPreset } = useDateRange()

  useEffect(() => {
    setPreset('today')
    return () => { setPreset('thisMonth') }
  }, [setPreset])

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

      <UnderlineButtonTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {locales.length > 0 && activeTab === 'ventas' && (
        <VentasTab
          localIds={activeLocalIds}
          allLocalIds={activeLocalIds}
          locales={locales}
          localLabel={localLabel}
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
        />
      )}
    </PageTransition>
  )
}

