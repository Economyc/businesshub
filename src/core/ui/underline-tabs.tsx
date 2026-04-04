import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface TabItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface RouteTabsProps {
  tabs: TabItem[]
  className?: string
}

/** Route-based underline tabs (uses NavLink) */
export function UnderlineTabs({ tabs, className }: RouteTabsProps) {
  return (
    <div
      className={cn('flex flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain mb-5 border-b border-border scrollbar-hide touch-pan-x', className)}
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex items-center justify-center gap-2 px-4 py-3 text-body font-medium transition-all duration-200 border-b-2 -mb-px whitespace-nowrap shrink-0',
              isActive
                ? 'text-graphite border-graphite'
                : 'text-mid-gray border-transparent hover:text-graphite'
            )
          }
        >
          <Icon size={15} strokeWidth={1.5} />
          {label}
        </NavLink>
      ))}
    </div>
  )
}

interface ButtonTabsProps {
  tabs: { value: string; label: string; icon: LucideIcon }[]
  active: string
  onChange: (value: string) => void
  className?: string
}

/** State-based underline tabs (uses buttons) */
export function UnderlineButtonTabs({ tabs, active, onChange, className }: ButtonTabsProps) {
  return (
    <div
      className={cn('flex flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain mb-5 border-b border-border scrollbar-hide touch-pan-x', className)}
    >
      {tabs.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 text-body font-medium transition-all duration-200 border-b-2 -mb-px whitespace-nowrap shrink-0',
            active === value
              ? 'text-graphite border-graphite'
              : 'text-mid-gray border-transparent hover:text-graphite'
          )}
        >
          <Icon size={15} strokeWidth={1.5} />
          {label}
        </button>
      ))}
    </div>
  )
}
