import { useState } from 'react'
import { RefreshCw, ShoppingBag, Package } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
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

  // Auto-select "all" once locales are loaded (no change needed, default is 'all')

  return (
    <PageTransition>
      <PageHeader title="POS Sync">
        <div className="flex items-center gap-3">
          <DateRangePicker />
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-mid-gray" />
            <span className="text-caption text-mid-gray">Restaurant.pe</span>
          </div>
        </div>
      </PageHeader>

      {/* Local selector */}
      <div className="mb-4">
        {loadingLocales ? (
          <div className="text-body text-mid-gray">Cargando locales...</div>
        ) : localesError ? (
          <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-body">
            Error conectando al POS: {localesError}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <label className="text-body font-medium text-graphite">Local:</label>
            <select
              value={selectedLocal}
              onChange={(e) => setSelectedLocal(e.target.value)}
              className="text-body bg-surface border border-border rounded-lg px-3 py-2 text-graphite"
            >
              <option value="all">Todos los locales</option>
              {locales.map((l) => (
                <option key={l.local_id} value={l.local_id}>
                  {l.local_descripcion}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <UnderlineButtonTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {locales.length > 0 && activeTab === 'ventas' && (
        <VentasTab
          localIds={selectedLocal === 'all' ? locales.map((l) => Number(l.local_id)) : [Number(selectedLocal)]}
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
