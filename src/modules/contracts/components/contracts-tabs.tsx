import { UnderlineTabs } from '@/core/ui/underline-tabs'
import { FileText, LayoutTemplate } from 'lucide-react'
import { usePermissions } from '@/core/hooks/use-permissions'
import { TAB_IDS } from '@/core/config/access-registry'

const TABS = [
  { to: '/contracts', label: 'Contratos', icon: FileText, end: true, tabId: TAB_IDS.contractsList },
  { to: '/contracts/templates', label: 'Plantillas', icon: LayoutTemplate, end: false, tabId: TAB_IDS.contractsTemplates },
]

export function ContractsTabs() {
  const { canAccessTab } = usePermissions()
  const tabs = TABS.filter((t) => canAccessTab(t.tabId)).map(({ tabId: _tabId, ...rest }) => rest)
  return <UnderlineTabs tabs={tabs} />
}
