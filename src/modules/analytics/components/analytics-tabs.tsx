import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PieChart, ShoppingCart, Store, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface AnalyticsTab {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const TABS: AnalyticsTab[] = [
  { to: '/analytics', label: 'General', icon: LayoutDashboard, end: true },
  { to: '/analytics/pos', label: 'POS', icon: Store },
  { to: '/analytics/costs', label: 'Costos', icon: PieChart },
  { to: '/analytics/purchases', label: 'Compras', icon: ShoppingCart },
  { to: '/analytics/payroll', label: 'Nómina', icon: Users },
]

export function AnalyticsTabs() {
  return (
    <div className="mb-6 flex flex-wrap gap-1.5 p-1 rounded-2xl bg-bone/60 border border-border/60 w-fit max-w-full overflow-x-auto scrollbar-hide">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'inline-flex items-center gap-2 px-3.5 h-9 rounded-xl text-caption font-medium transition-all duration-200 whitespace-nowrap',
              isActive
                ? 'bg-surface text-dark-graphite shadow-sm'
                : 'text-mid-gray hover:text-graphite hover:bg-surface/60'
            )
          }
        >
          <Icon size={14} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </div>
  )
}
