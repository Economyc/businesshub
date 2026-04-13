import { useState, useEffect, useMemo } from 'react'
import { ShoppingBag, Package, XCircle } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { useCompany } from '@/core/hooks/use-company'
import { usePosLocales } from '../hooks'
import { VentasTab } from './ventas-tab'
import { CatalogoTab } from './catalogo-tab'
import { AnuladasTab } from './anuladas-tab'
import type { PosLocal } from '../types'
import type { Company } from '@/core/types'

const TABS = [
  { value: 'ventas', label: 'Ventas', icon: ShoppingBag },
  { value: 'catalogo', label: 'Catálogo', icon: Package },
  { value: 'anuladas', label: 'Anuladas', icon: XCircle },
]

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function findMatchingLocal(locales: PosLocal[], company: Company | null): PosLocal | null {
  if (!company || !company.location || locales.length === 0) return null

  const companyNorm = normalize(`${company.name} ${company.location}`)
  const locationNorm = normalize(company.location)

  const exact = locales.find((l) => normalize(l.local_descripcion) === companyNorm)
  if (exact) return exact

  const partial = locales.find((l) => normalize(l.local_descripcion).includes(companyNorm))
  if (partial) return partial

  const locMatch = locales.find((l) => normalize(l.local_descripcion).includes(locationNorm))
  if (locMatch) return locMatch

  return null
}

export function PosSyncPage() {
  const [activeTab, setActiveTab] = useState('ventas')
  const { locales, loading: loadingLocales, error: localesError } = usePosLocales()
  const { selectedCompany } = useCompany()
  const { setPreset } = useDateRange()

  useEffect(() => {
    setPreset('today')
    return () => { setPreset('thisMonth') }
  }, [setPreset])

  const matchedLocal = useMemo(
    () => findMatchingLocal(locales, selectedCompany),
    [locales, selectedCompany]
  )

  const activeLocalIds = useMemo(() => {
    if (matchedLocal) return [Number(matchedLocal.local_id)]
    return locales.map((l) => Number(l.local_id))
  }, [matchedLocal, locales])

  const localName = matchedLocal?.local_descripcion ?? null
  const localLabel = localName ?? (locales.length > 0 ? `${locales.length} locales` : null)

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
