import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { BarChart3, Users, Briefcase, DollarSign, Settings, Home, Search, ChevronsLeft, Building2, Tags, BadgeCheck, Network, Handshake, ClipboardList, FileSignature, Wallet, Receipt, Gift, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CommandPalette } from '@/core/ui/command-palette'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/home', label: 'Home', icon: Home },
      { to: '/analytics', label: 'Análisis', icon: BarChart3 },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { to: '/finance', label: 'Finanzas', icon: DollarSign },
      { to: '/cartera', label: 'Cartera', icon: Wallet },
      { to: '/closings', label: 'Cierres de Caja', icon: ClipboardList },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/contracts', label: 'Contratos', icon: FileSignature },
      { to: '/partners', label: 'Socios', icon: Handshake },
    ],
  },
  {
    title: 'Personas',
    items: [
      { to: '/talent', label: 'Equipo', icon: Users },
      { to: '/payroll', label: 'Nomina', icon: Receipt },
      { to: '/prestaciones', label: 'Prestaciones', icon: Gift },
      { to: '/suppliers', label: 'Proveedores', icon: Briefcase },
    ],
  },
]

const SETTINGS_ITEMS = [
  { to: '/settings/companies', label: 'Compañías', icon: Building2 },
  { to: '/settings/categories', label: 'Categorías', icon: Tags },
  { to: '/settings/roles', label: 'Cargos', icon: BadgeCheck },
  { to: '/settings/departments', label: 'Departamentos', icon: Network },
]


interface SidebarProps {
  onNavClick?: () => void
}

function getActiveSections(pathname: string): Set<string> {
  const active = new Set<string>()
  for (const section of NAV_SECTIONS) {
    if (section.title && section.items.some(item => pathname.startsWith(item.to))) {
      active.add(section.title)
    }
  }
  return active
}

export function Sidebar({ onNavClick }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const [openSections, setOpenSections] = useState<Set<string>>(() => getActiveSections(location.pathname))

  // Auto-expand section when navigating to a route within it
  useEffect(() => {
    const active = getActiveSections(location.pathname)
    if (active.size > 0) {
      setOpenSections(prev => {
        const next = new Set(prev)
        active.forEach(s => next.add(s))
        return next
      })
    }
  }, [location.pathname])

  function toggleSection(title: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  const isSettingsRoute = location.pathname.startsWith('/settings')
  const [settingsOpen, setSettingsOpen] = useState(isSettingsRoute)

  // Sync settings panel with route
  useEffect(() => {
    if (isSettingsRoute) setSettingsOpen(true)
    else setSettingsOpen(false)
  }, [isSettingsRoute])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented && settingsOpen) {
        e.preventDefault()
        setSettingsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
    }
  }, [settingsOpen])

  function handleSettingsClick() {
    if (settingsOpen && isSettingsRoute) {
      // Already in settings, toggle panel closed and navigate away
      setSettingsOpen(false)
      navigate('/home')
    } else if (settingsOpen) {
      // Panel open but not on settings route, close it
      setSettingsOpen(false)
    } else {
      // Open panel and navigate to first settings item
      setSettingsOpen(true)
      navigate('/settings/companies')
    }
  }

  return (
    <div className="flex flex-shrink-0">
      {/* Main sidebar */}
      <nav
        className={cn(
          'bg-bone border-r border-border py-5 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out relative z-10',
        settingsOpen && 'shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]',
          collapsed ? 'w-[60px]' : 'w-[200px]'
        )}
      >
        {/* Search — inline CommandPalette dropdown */}
        {!collapsed ? (
          <div className="px-3 mb-3">
            <CommandPalette />
          </div>
        ) : (
          <div className="flex justify-center mb-3">
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="group/search relative flex items-center justify-center p-1.5 rounded-md text-mid-gray/50 hover:text-graphite transition-colors duration-200"
            >
              <Search size={16} strokeWidth={1.5} />
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-dark-graphite dark:bg-[#2a2a2a] px-3 py-1.5 text-caption font-medium text-white dark:text-[#e0e0e0] shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/search:opacity-100 group-hover/search:scale-100">
                Buscar (Ctrl K)
              </span>
            </button>
          </div>
        )}

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto">
          {NAV_SECTIONS.map((section, sIdx) => {
            const isOpen = !section.title || collapsed || openSections.has(section.title)
            return (
              <div key={section.title ?? sIdx}>
                {section.title && !collapsed && (
                  <button
                    onClick={() => toggleSection(section.title!)}
                    className="w-full flex items-center justify-between px-5 pt-4 pb-1 group/section"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-mid-gray/60 group-hover/section:text-mid-gray transition-colors">
                      {section.title}
                    </span>
                    <ChevronRight
                      size={12}
                      strokeWidth={2}
                      className={cn(
                        'text-mid-gray/40 group-hover/section:text-mid-gray transition-all duration-200',
                        isOpen && 'rotate-90'
                      )}
                    />
                  </button>
                )}
                {section.title && collapsed && <div className="mx-4 my-2 border-t border-border/60" />}
                <div
                  className={cn(
                    'grid transition-all duration-200 ease-in-out',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className="overflow-hidden">
                    {section.items.map(({ to, label, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={onNavClick}
                        className={({ isActive }) =>
                          cn(
                            'group/nav relative flex items-center gap-2.5 py-2.5 text-body transition-all duration-150',
                            collapsed ? 'justify-center px-0' : 'px-5',
                            isActive
                              ? 'text-dark-graphite font-medium bg-bone border-r-2 border-graphite'
                              : 'text-graphite/70 hover:bg-card-bg hover:text-graphite'
                          )
                        }
                      >
                        <Icon size={18} strokeWidth={1.5} />
                        {!collapsed && label}
                        {collapsed && (
                          <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-dark-graphite dark:bg-[#2a2a2a] px-3 py-1.5 text-caption font-medium text-white dark:text-[#e0e0e0] shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/nav:opacity-100 group-hover/nav:scale-100">
                          {label}
                        </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom — Settings + Collapse toggle */}
        <div className={cn('flex items-center border-t border-border', collapsed ? 'mx-3 pt-1 flex-col gap-1' : 'mx-4 pt-1')}>
          {collapsed ? (
            <button
              onClick={handleSettingsClick}
              className="group/settings relative flex items-center justify-center p-1.5 rounded-md text-mid-gray/50 hover:text-graphite transition-colors duration-200"
            >
              <Settings size={16} strokeWidth={1.5} />
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-dark-graphite dark:bg-[#2a2a2a] px-3 py-1.5 text-caption font-medium text-white dark:text-[#e0e0e0] shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/settings:opacity-100 group-hover/settings:scale-100">
                Configuración
              </span>
            </button>
          ) : (
            <button
              onClick={handleSettingsClick}
              className={cn(
                'flex items-center gap-2 py-2 px-1 text-caption transition-all duration-150 flex-1 min-w-0',
                settingsOpen
                  ? 'text-dark-graphite font-medium'
                  : 'text-graphite/70 hover:text-graphite'
              )}
            >
              <Settings size={16} strokeWidth={1.5} className="shrink-0" />
              Configuración
            </button>
          )}
          <button
            onClick={() => { if (!collapsed) setSettingsOpen(false); setCollapsed(!collapsed) }}
            className="group/toggle relative flex items-center justify-center p-1.5 rounded-md text-mid-gray/50 hover:text-graphite transition-colors duration-200 shrink-0"
          >
            <ChevronsLeft
              size={15}
              strokeWidth={1.5}
              className={cn('transition-transform duration-300', collapsed && 'rotate-180')}
            />
            {collapsed && (
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-dark-graphite dark:bg-[#2a2a2a] px-3 py-1.5 text-caption font-medium text-white dark:text-[#e0e0e0] shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/toggle:opacity-100 group-hover/toggle:scale-100">
                Expandir
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Settings sub-panel */}
      <div
        className={cn(
          'bg-card-bg border-r border-border flex flex-col py-5 overflow-hidden transition-all duration-300 ease-in-out',
          settingsOpen ? 'w-[200px] opacity-100' : 'w-0 opacity-0'
        )}
      >
        <div className="px-4 mb-4">
          <h3 className="text-caption uppercase tracking-wider text-mid-gray font-medium">Configuración</h3>
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          {SETTINGS_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-4 py-2.5 text-body transition-all duration-150 whitespace-nowrap',
                  isActive
                    ? 'text-dark-graphite font-medium bg-bone/80'
                    : 'text-graphite/70 hover:bg-bone/50 hover:text-graphite'
                )
              }
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </div>
        <div className="mx-4 pt-1 border-t border-border flex justify-end">
          <button
            onClick={() => setSettingsOpen(false)}
            className="group/close relative flex items-center justify-center p-1.5 rounded-md text-mid-gray/50 hover:text-graphite transition-colors duration-200"
          >
            <ChevronsLeft size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
