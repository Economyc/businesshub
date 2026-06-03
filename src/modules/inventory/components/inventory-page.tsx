import { useMemo, useState } from 'react'
import { Boxes, BookOpen, Package, ClipboardCheck, PackagePlus, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { usePermissions } from '@/core/hooks/use-permissions'
import { TAB_IDS } from '@/core/config/access-registry'
import { ItemsTab } from './items-tab'
import { RecipesTab } from './recipes-tab'
import { StockTab } from './stock-tab'
import { CountTab } from './count-tab'
import { EntriesTab } from './entries-tab'
import { WasteTab } from './waste-tab'
import { PlaceholderTab } from './placeholder-tab'

type TabValue = 'stock' | 'recipes' | 'ingredients' | 'count' | 'entries' | 'waste'

interface TabDef {
  value: TabValue
  label: string
  icon: LucideIcon
  tabId: string
}

const TABS: TabDef[] = [
  { value: 'stock', label: 'Stock', icon: Boxes, tabId: TAB_IDS.inventoryStock },
  { value: 'recipes', label: 'Recetas', icon: BookOpen, tabId: TAB_IDS.inventoryRecipes },
  { value: 'ingredients', label: 'Insumos', icon: Package, tabId: TAB_IDS.inventoryIngredients },
  { value: 'count', label: 'Conteo', icon: ClipboardCheck, tabId: TAB_IDS.inventoryCount },
  { value: 'entries', label: 'Entradas', icon: PackagePlus, tabId: TAB_IDS.inventoryEntries },
  { value: 'waste', label: 'Mermas', icon: Trash2, tabId: TAB_IDS.inventoryWaste },
]

export function InventoryPage() {
  const { canAccessTab } = usePermissions()

  const tabs = useMemo(() => TABS.filter((t) => canAccessTab(t.tabId)), [canAccessTab])

  // Fase 1: Insumos es lo único operativo, así que arranca ahí si está permitido;
  // si no, cae al primer tab accesible.
  const [active, setActive] = useState<TabValue>(() => {
    const preferred = tabs.find((t) => t.value === 'ingredients')
    return (preferred ?? tabs[0])?.value ?? 'ingredients'
  })

  const activeDef = TABS.find((t) => t.value === active)

  return (
    <PageTransition>
      <PageHeader title="Inventarios" subtitle={<span className="text-body text-mid-gray">Insumos, recetas y control de stock del local</span>} />

      {tabs.length > 0 && (
        <UnderlineButtonTabs
          tabs={tabs.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))}
          active={active}
          onChange={(v) => setActive(v as TabValue)}
        />
      )}

      {active === 'ingredients' ? (
        <ItemsTab />
      ) : active === 'recipes' ? (
        <RecipesTab />
      ) : active === 'stock' ? (
        <StockTab onNavigate={setActive} />
      ) : active === 'count' ? (
        <CountTab />
      ) : active === 'entries' ? (
        <EntriesTab />
      ) : active === 'waste' ? (
        <WasteTab />
      ) : (
        <PlaceholderTab icon={activeDef?.icon ?? Package} label={activeDef?.label ?? ''} />
      )}
    </PageTransition>
  )
}
