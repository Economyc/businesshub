import { UnderlineTabs } from '@/core/ui/underline-tabs'
import { List, ShoppingCart, Package, Wallet, FileText, Target, Repeat } from 'lucide-react'

const TABS = [
  { to: '/finance', label: 'Transacciones', icon: List, end: true },
  { to: '/finance/recurring', label: 'Recurrentes', icon: Repeat, end: false },
  { to: '/finance/purchases', label: 'Compras', icon: ShoppingCart, end: true },
  { to: '/finance/purchases/products', label: 'Insumos', icon: Package, end: false },
  { to: '/finance/cash-flow', label: 'Flujo de Caja', icon: Wallet, end: false },
  { to: '/finance/income-statement', label: 'Estado de Resultados', icon: FileText, end: false },
  { to: '/finance/budget', label: 'Presupuesto', icon: Target, end: false },
]

export function FinanceTabs() {
  return (
    <div className="mb-5">
      <UnderlineTabs tabs={TABS} className="mb-0" />
    </div>
  )
}
