import { useState, useEffect } from 'react'
import { ShoppingBag, Package, XCircle } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
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
          <ConnectionBadge error={localesError} loading={loadingLocales} />
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

function ConnectionBadge({ error, loading }: { error: string | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 bg-bone px-2.5 h-7 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-mid-gray animate-pulse shrink-0" />
        <span className="text-caption text-mid-gray">Conectando...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 bg-negative-bg px-2.5 h-7 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        <span className="text-caption text-negative-text">Desconectado</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 bg-positive-bg px-2.5 h-7 rounded-full">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
      </span>
      <span className="text-caption text-positive-text">En vivo</span>
    </div>
  )
}
