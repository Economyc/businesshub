import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { BarChart3, Users, Briefcase, DollarSign, Home, Search, ChevronsLeft, Building2, Tags, BadgeCheck, Network, Handshake, ClipboardList, FileSignature, Wallet, Receipt, Gift, ChevronRight, ChevronsUpDown, Check, MapPin, CircleUser, LogOut, Landmark, Boxes, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CommandPalette } from '@/core/ui/command-palette'
import { CompanyLogo } from '@/core/ui/company-logo'
import { ThemeToggle } from '@/core/ui/theme-toggle'
import { useAuth } from '@/core/hooks/use-auth'
import { useCompany } from '@/core/hooks/use-company'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
}

interface NavSection {
  title?: string
  icon?: typeof Home
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
    icon: Landmark,
    items: [
      { to: '/finance', label: 'Finanzas', icon: DollarSign },
      { to: '/cartera', label: 'Cartera', icon: Wallet },
      { to: '/closings', label: 'Cierres de Caja', icon: ClipboardList },
    ],
  },
  {
    title: 'Operaciones',
    icon: Boxes,
    items: [
      { to: '/contracts', label: 'Contratos', icon: FileSignature },
      { to: '/partners', label: 'Socios', icon: Handshake },
    ],
  },
  {
    title: 'Personas',
    icon: UserRound,
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
  const { user, logout } = useAuth()
  const { companies, selectedCompany, selectCompany } = useCompany()

  const [openSections, setOpenSections] = useState<Set<string>>(() => getActiveSections(location.pathname))
  const [companyOpen, setCompanyOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const companyRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

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

  // Close dropdowns on outside click / Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (companyOpen) { e.preventDefault(); setCompanyOpen(false) }
        if (userMenuOpen) { e.preventDefault(); setUserMenuOpen(false) }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKey, true)
    }
  }, [companyOpen, userMenuOpen])

  return (
    <nav
      className={cn(
        'bg-bone border-r border-border py-5 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out',
        collapsed ? 'w-[60px]' : 'w-[200px]'
      )}
    >
      {/* Company selector */}
      <div className={cn('mb-3', collapsed ? 'px-2' : 'px-3')} ref={companyRef}>
        {!collapsed ? (
          <div className="relative">
            <button
              onClick={() => setCompanyOpen(!companyOpen)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[#f4f3f1] dark:bg-[#171717] hover:bg-[#eeedeb] dark:hover:bg-[#1c1c1c] transition-all duration-150"
            >
              <CompanyLogo company={selectedCompany} />
              <div className="min-w-0 flex-1 text-left">
                {selectedCompany?.location && (
                  <div className="flex items-center gap-0.5 text-body font-medium text-dark-graphite truncate">
                    <MapPin size={11} />
                    {selectedCompany.location}
                  </div>
                )}
              </div>
              <ChevronsUpDown size={14} className="text-mid-gray shrink-0" />
            </button>

            {companyOpen && (
              <div className="absolute left-0 top-full mt-2 min-w-[250px] bg-surface-elevated border border-border rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => { selectCompany(company); setCompanyOpen(false) }}
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
          <div className="relative flex justify-center">
            <button
              onClick={() => setCompanyOpen(!companyOpen)}
              className="group/company relative p-1.5 rounded-md hover:bg-[#eeedeb] dark:hover:bg-[#1c1c1c] transition-colors duration-200"
            >
              <CompanyLogo company={selectedCompany} />
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-dark-graphite dark:bg-[#2a2a2a] px-3 py-1.5 text-caption font-medium text-white dark:text-[#e0e0e0] shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/company:opacity-100 group-hover/company:scale-100">
                {selectedCompany?.name ?? 'Compañía'}
              </span>
            </button>

            {companyOpen && (
              <div className="absolute left-full ml-2 top-0 min-w-[250px] bg-surface-elevated border border-border rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => { selectCompany(company); setCompanyOpen(false) }}
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
        )}
      </div>

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
                  className={cn(
                    'group/section w-full flex items-center gap-2.5 py-2.5 px-5 text-body transition-all duration-150',
                    isOpen
                      ? 'text-dark-graphite font-medium'
                      : 'text-graphite/70 hover:bg-card-bg hover:text-graphite'
                  )}
                >
                  {section.icon && <section.icon size={18} strokeWidth={1.5} />}
                  <span className="flex-1 text-left">{section.title}</span>
                  <ChevronRight
                    size={14}
                    strokeWidth={1.5}
                    className={cn(
                      'text-mid-gray/40 group-hover/section:text-mid-gray transition-all duration-200',
                      isOpen && 'rotate-90'
                    )}
                  />
                </button>
              )}
              {section.title && collapsed && (
                <button
                  onClick={() => toggleSection(section.title!)}
                  className="group/section relative w-full flex justify-center py-2.5 text-graphite/70 hover:bg-card-bg hover:text-graphite transition-all duration-150"
                >
                  {section.icon && <section.icon size={18} strokeWidth={1.5} />}
                  <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-dark-graphite dark:bg-[#2a2a2a] px-3 py-1.5 text-caption font-medium text-white dark:text-[#e0e0e0] shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/section:opacity-100 group-hover/section:scale-100">
                    {section.title}
                  </span>
                </button>
              )}
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
                          collapsed ? 'justify-center px-0' : (section.title ? 'pl-8 pr-5' : 'px-5'),
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

      {/* Bottom — User menu + Collapse toggle (same row) */}
      <div className={cn('flex items-center border-t border-border', collapsed ? 'mx-3 pt-1 flex-col gap-1' : 'mx-4 pt-1')}>
        {/* User menu */}
        <div className="relative flex-1 min-w-0" ref={userMenuRef}>
          {collapsed ? (
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="group/user relative flex items-center justify-center p-1.5 rounded-md text-mid-gray/50 hover:text-graphite transition-colors duration-200"
            >
              <div className="w-6 h-6 rounded-full bg-graphite/10 flex items-center justify-center">
                <CircleUser size={14} strokeWidth={1.5} className="text-graphite" />
              </div>
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-dark-graphite dark:bg-[#2a2a2a] px-3 py-1.5 text-caption font-medium text-white dark:text-[#e0e0e0] shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/user:opacity-100 group-hover/user:scale-100">
                {user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuario'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-2 px-1 py-2 rounded-lg hover:bg-[#eeedeb] dark:hover:bg-[#1c1c1c] transition-all duration-150 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-graphite/10 flex items-center justify-center shrink-0">
                <CircleUser size={14} strokeWidth={1.5} className="text-graphite" />
              </div>
              <span className="text-body font-medium text-dark-graphite truncate flex-1 text-left">{user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuario'}</span>
            </button>
          )}

          {/* User dropdown — opens upward */}
          {userMenuOpen && (
            <div className={cn(
              'absolute bottom-full mb-2 bg-bone border border-border rounded-xl shadow-lg z-50 p-2',
              collapsed ? 'left-full ml-2 bottom-0 mb-0' : 'left-0 w-[250px]'
            )}>
              {/* Main card */}
              <div className="bg-surface-elevated rounded-lg border border-border/60 shadow-sm">
                {/* User info header */}
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="w-10 h-10 rounded-full bg-graphite/10 flex items-center justify-center shrink-0">
                    <CircleUser size={22} strokeWidth={1.5} className="text-graphite" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-body font-medium text-dark-graphite truncate">{user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuario'}</div>
                    <div className="text-caption text-mid-gray truncate">{user?.email ?? ''}</div>
                  </div>
                </div>
                <div className="border-t border-border/60" />
                <ThemeToggle />
                <div className="border-t border-border/60" />
                {/* Settings items */}
                <div className="py-1">
                  <div className="px-4 pt-2 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-mid-gray/60">Configuración</span>
                  </div>
                  {SETTINGS_ITEMS.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => { setUserMenuOpen(false); onNavClick?.() }}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-4 py-2 text-body transition-colors duration-100 rounded-md mx-1',
                          isActive
                            ? 'text-dark-graphite font-medium bg-bone/80'
                            : 'text-graphite/70 hover:text-dark-graphite hover:bg-bone/50'
                        )
                      }
                    >
                      <Icon size={15} strokeWidth={1.5} />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Logout sub-card */}
              <div className="mt-2 bg-surface/60 rounded-lg border border-border/60">
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    logout()
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-body text-mid-gray hover:text-dark-graphite transition-colors duration-150"
                >
                  <LogOut size={16} strokeWidth={1.5} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
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
  )
}
