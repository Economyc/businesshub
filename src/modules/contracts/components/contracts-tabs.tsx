import { UnderlineTabs } from '@/core/ui/underline-tabs'
import { FileText, LayoutTemplate } from 'lucide-react'

const TABS = [
  { to: '/contracts', label: 'Contratos', icon: FileText, end: true },
  { to: '/contracts/templates', label: 'Plantillas', icon: LayoutTemplate, end: false },
]

export function ContractsTabs() {
  return <UnderlineTabs tabs={TABS} />
}
