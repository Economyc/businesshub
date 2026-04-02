import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { BarChart3, Users, Briefcase, DollarSign, Settings, ChevronsUpDown, Check, MapPin, Home, Search, ChevronsLeft, Building2, Tags, BadgeCheck, Network, Handshake, ClipboardList, FileSignature, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { CompanyLogo } from '@/core/ui/company-logo'
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

export function Sidebar({ onNavClick }: SidebarProps) {
  const { companies, selectedCompany, selectCompany } = useCompany()
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const isSettingsRoute = location.pathname.startsWith('/settings')
  const [settingsOpen, setSettingsOpen] = useState(isSettingsRoute)

  // Sync settings panel with route
  useEffect(() => {
    if (isSettingsRoute) setSettingsOpen(true)
    else setSettingsOpen(false)
  }, [isSettingsRoute])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (open) {
          e.preventDefault()
          setOpen(false)
        } else if (settingsOpen) {
          e.preventDefault()
          setSettingsOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, settingsOpen])

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
          collapsed ? 'w-[60px]' : 'w-[240px]'
        )}
      >
        {/* Workspace switcher */}
        {!collapsed ? (
          <div className="px-3 mb-4 relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(!open)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-selector-bg border border-white/60 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_2px_6px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.3)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.4)] transition-all duration-150"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CompanyLogo company={selectedCompany} />
                <div className="min-w-0 text-left">
                  <div className="text-body font-medium text-dark-graphite truncate">
                    {selectedCompany?.name ?? 'BusinessHub'}
                  </div>
                  {selectedCompany?.location && (
                    <div className="flex items-center gap-1 text-caption text-mid-gray truncate">
                      <span className="flex items-center gap-0.5">
                        <MapPin size={10} />
                        {selectedCompany.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <ChevronsUpDown size={14} className="text-mid-gray shrink-0" />
            </button>

            {open && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-surface-elevated border border-border rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => { selectCompany(company); setOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100',
                      selectedCompany?.id === company.id
                        ? 'bg-bone'
                        : 'hover:bg-bone/50'
                    )}
                  >
                    <CompanyLogo company={company} />
                    <div className="min-w-0 flex-1">
                      <div className="text-body text-dark-graphite truncate">{company.name}</div>
                      {company.location && (
                        <div className="flex items-center gap-0.5 text-[11px] text-mid-gray truncate">
                          <MapPin size={9} />
                          {company.location}
                        </div>
                      )}
                    </div>
                    {selectedCompany?.id === company.id && (
                      <Check size={14} className="text-graphite shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <CompanyLogo company={selectedCompany} />
          </div>
        )}

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
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={section.title ?? sIdx}>
              {section.title && !collapsed && (
                <div className="px-5 pt-4 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-mid-gray/60">
                    {section.title}
                  </span>
                </div>
              )}
              {section.title && collapsed && <div className="mx-4 my-2 border-t border-border/60" />}
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
          ))}
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
