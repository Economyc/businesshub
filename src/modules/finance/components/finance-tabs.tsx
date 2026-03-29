import { UnderlineTabs } from '@/core/ui/underline-tabs'
import { List, ShoppingCart, Package, Wallet, FileText, Target } from 'lucide-react'
import { DateRangePicker } from './date-range-picker'

const TABS = [
  { to: '/finance', label: 'Transacciones', icon: List, end: true },
  { to: '/finance/purchases', label: 'Compras', icon: ShoppingCart, end: true },
  { to: '/finance/purchases/products', label: 'Insumos', icon: Package, end: false },
  { to: '/finance/cash-flow', label: 'Flujo de Caja', icon: Wallet, end: false },
  { to: '/finance/income-statement', label: 'Estado de Resultados', icon: FileText, end: false },
  { to: '/finance/budget', label: 'Presupuesto', icon: Target, end: false },
]

export function FinanceTabs() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
      <UnderlineTabs tabs={TABS} className="mb-0" />
      <DateRangePicker />
    </div>
  )
}
