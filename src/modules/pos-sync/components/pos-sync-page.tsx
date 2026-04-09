import { useState, useEffect } from 'react'
import { ShoppingBag, Package } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePosLocales } from '../hooks'
import { VentasTab } from './ventas-tab'
import { CatalogoTab } from './catalogo-tab'

const TABS = [
  { value: 'ventas', label: 'Ventas', icon: ShoppingBag },
  { value: 'catalogo', label: 'Catálogo', icon: Package },
]

export function PosSyncPage() {
  const [activeTab, setActiveTab] = useState('ventas')
  const { locales, loading: loadingLocales, error: localesError } = usePosLocales()
  const [selectedLocal, setSelectedLocal] = useState<string>('all')
  const { setPreset } = useDateRange()

  useEffect(() => { setPreset('today') }, [setPreset])

  return (
    <PageTransition>
      <PageHeader title="POS Sync">
        <div className="flex items-center gap-3">
          <ConnectionBadge error={localesError} />
          <DateRangePicker />
        </div>
      </PageHeader>

      {/* Local selector pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-5">
        {loadingLocales ? (
          <>
            <div className="bg-bone rounded-full h-8 w-20 animate-pulse shrink-0" />
            <div className="bg-bone rounded-full h-8 w-20 animate-pulse shrink-0" />
            <div className="bg-bone rounded-full h-8 w-20 animate-pulse shrink-0" />
          </>
        ) : (
          <>
            {locales.length > 1 && (
              <button
                onClick={() => setSelectedLocal('all')}
                className={`h-8 px-3 rounded-full text-caption font-medium transition-colors duration-200 whitespace-nowrap shrink-0 ${
                  selectedLocal === 'all'
                    ? 'bg-dark-graphite text-white'
                    : 'bg-bone text-graphite hover:bg-smoke'
                }`}
                aria-label="Seleccionar todos los locales"
              >
                Todos
              </button>
            )}
            {locales.map((l) => (
              <button
                key={l.local_id}
                onClick={() => setSelectedLocal(l.local_id)}
                className={`h-8 px-3 rounded-full text-caption font-medium transition-colors duration-200 whitespace-nowrap shrink-0 ${
                  selectedLocal === l.local_id
                    ? 'bg-dark-graphite text-white'
                    : 'bg-bone text-graphite hover:bg-smoke'
                }`}
                aria-label={`Seleccionar local ${l.local_descripcion}`}
              >
                {l.local_descripcion}
              </button>
            ))}
          </>
        )}
      </div>

      <UnderlineButtonTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {locales.length > 0 && activeTab === 'ventas' && (
        <VentasTab
          localIds={selectedLocal === 'all' ? locales.map((l) => Number(l.local_id)) : [Number(selectedLocal)]}
          allLocalIds={locales.map((l) => Number(l.local_id))}
          locales={locales}
        />
      )}
      {locales.length > 0 && activeTab === 'catalogo' && selectedLocal !== 'all' && (
        <CatalogoTab localId={Number(selectedLocal)} />
      )}
      {activeTab === 'catalogo' && selectedLocal === 'all' && (
        <div className="text-body text-mid-gray py-8 text-center">
          Selecciona un local específico para ver el catálogo.
        </div>
      )}
    </PageTransition>
  )
}

function ConnectionBadge({ error }: { error: string | null }) {
  if (error) {
    return (
      <div className="flex items-center gap-1.5 bg-negative-bg px-2.5 h-7 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        <span className="text-caption text-negative-text">Restaurant.pe</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 bg-positive-bg px-2.5 h-7 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <span className="text-caption text-mid-gray">Restaurant.pe</span>
    </div>
  )
}
