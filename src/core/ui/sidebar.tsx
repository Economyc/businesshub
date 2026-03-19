import { NavLink } from 'react-router-dom'
import { BarChart3, Users, Briefcase, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/talent', label: 'Talento', icon: Users },
  { to: '/suppliers', label: 'Proveedores', icon: Briefcase },
  { to: '/finance', label: 'Finanzas', icon: DollarSign },
]

export function Sidebar() {
  return (
    <nav className="w-[210px] bg-white border-r border-border py-5 flex-shrink-0">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-5 py-2.5 text-[13px] transition-all duration-150',
              isActive
                ? 'text-dark-graphite font-medium bg-bone border-r-2 border-graphite'
                : 'text-mid-gray hover:bg-card-bg hover:text-graphite'
            )
          }
        >
          <Icon size={18} strokeWidth={1.5} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
