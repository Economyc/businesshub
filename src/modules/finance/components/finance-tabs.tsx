import { UnderlineTabs } from '@/core/ui/underline-tabs'
import { List, Repeat } from 'lucide-react'

const TABS = [
  { to: '/finance', label: 'Historial', icon: List, end: true },
  { to: '/finance/recurring', label: 'Recurrentes', icon: Repeat },
]

export function FinanceTabs() {
  return <UnderlineTabs tabs={TABS} />
}
