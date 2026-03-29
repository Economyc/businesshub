import { UnderlineTabs } from '@/core/ui/underline-tabs'
import { LayoutDashboard, PieChart, ShoppingCart, Users } from 'lucide-react'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'

const TABS = [
  { to: '/analytics', label: 'General', icon: LayoutDashboard, end: true },
  { to: '/analytics/costs', label: 'Estructura de Costos', icon: PieChart, end: false },
  { to: '/analytics/purchases', label: 'Compras e Insumos', icon: ShoppingCart, end: false },
  { to: '/analytics/payroll', label: 'Nómina', icon: Users, end: false },
]

export function AnalyticsTabs() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
      <UnderlineTabs tabs={TABS} className="mb-0" />
      <DateRangePicker />
    </div>
  )
}
