import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { BarChart3, Users, Briefcase, DollarSign, Home, ChevronsLeft, Building2, Tags, BadgeCheck, Network, Handshake, ClipboardList, FileSignature, Wallet, Receipt, Gift, ChevronRight, ChevronsUpDown, Check, MapPin, LogOut, Settings, Landmark, Boxes, UserRound, Bot, List, ShoppingCart, Package, Target, Scale, FileText, Shield, RefreshCw, Megaphone, Lock, LockOpen, LayoutDashboard, Store, PieChart, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CommandPalette } from '@/core/ui/command-palette'
import { CompanyLogo } from '@/core/ui/company-logo'
import { ThemeToggle } from '@/core/ui/theme-toggle'
import { AvatarPicker } from '@/core/ui/avatar-picker'
import { UserAvatar } from '@/core/ui/user-avatar'
import { NotificationBell } from '@/modules/notifications/components/notification-bell'
import { useAuth } from '@/core/hooks/use-auth'
import { useAvatarConfig } from '@/core/hooks/use-avatar-config'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { prefetchRoute, resetPrefetchCache } from '@/core/utils/prefetch'
import { prefetchSelectorSales } from '@/modules/home/selector-sales'
import type { ModuleKey } from '@/core/types/permissions'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  moduleKey?: ModuleKey
}

interface NavSection {
  title?: string
  icon?: typeof Home
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/home', label: 'Home', icon: Home, moduleKey: 'home' },
      { to: '/agent', label: 'Asistente AI', icon: Bot, moduleKey: 'agent' },
      { to: '/analytics', label: 'Análisis', icon: BarChart3, moduleKey: 'analytics' },
    ],
  },
  {
    title: 'Contabilidad',
    icon: Landmark,
    items: [
      { to: '/finance', label: 'Finanzas', icon: DollarSign, moduleKey: 'finance' },
      { to: '/cartera', label: 'Cartera', icon: Wallet, moduleKey: 'cartera' },
      { to: '/closings', label: 'Cierres de Caja', icon: ClipboardList, moduleKey: 'closings' },
      { to: '/payroll', label: 'Nomina', icon: Receipt, moduleKey: 'payroll' },
      { to: '/prestaciones', label: 'Prestaciones', icon: Gift, moduleKey: 'prestaciones' },
    ],
  },
  {
    title: 'Gestión',
    icon: Boxes,
    items: [
      { to: '/contracts', label: 'Contratos', icon: FileSignature, moduleKey: 'contracts' },
      { to: '/partners', label: 'Socios', icon: Handshake, moduleKey: 'partners' },
    ],
  },
  {
    title: 'Personas',
    icon: UserRound,
    items: [
      { to: '/talent', label: 'Equipo', icon: Users, moduleKey: 'talent' },
      { to: '/suppliers', label: 'Proveedores', icon: Briefcase, moduleKey: 'suppliers' },
    ],
  },
  {
    title: 'Mercadeo',
    icon: Megaphone,
    items: [
      { to: '/marketing/influencers', label: 'Influencers', icon: Users, moduleKey: 'marketing' },
    ],
  },
  {
    title: 'Integraciones',
    icon: RefreshCw,
    items: [
      { to: '/pos-sync', label: 'POS Sync', icon: RefreshCw },
    ],
  },
]

const SETTINGS_ITEMS = [
  { to: '/settings/team', label: 'Equipo', icon: Shield },
  { to: '/settings/companies', label: 'Compañías', icon: Building2 },
  { to: '/settings/categories', label: 'Categorías', icon: Tags },
  { to: '/settings/roles', label: 'Cargos', icon: BadgeCheck },
  { to: '/settings/departments', label: 'Departamentos', icon: Network },
]

const FINANCE_ITEMS: (NavItem & { end?: boolean })[] = [
  { to: '/finance', label: 'Transacciones', icon: List, end: true },
  { to: '/finance/purchases', label: 'Compras', icon: ShoppingCart, end: true },
  { to: '/finance/purchases/products', label: 'Insumos', icon: Package },
  { to: '/finance/cash-flow', label: 'Flujo de Caja', icon: Wallet },
  { to: '/finance/income-statement', label: 'Estado de Resultados', icon: FileText },
  { to: '/finance/budget', label: 'Presupuesto', icon: Target },
  { to: '/finance/reconciliation', label: 'Conciliacion', icon: Scale },
]

const ANALYTICS_ITEMS: (NavItem & { end?: boolean })[] = [
  { to: '/analytics', label: 'General', icon: LayoutDashboard, end: true },
  { to: '/analytics/pos', label: 'POS', icon: Store },
  { to: '/analytics/costs', label: 'Costos', icon: PieChart },
  { to: '/analytics/purchases', label: 'Compras', icon: ShoppingCart },
  { to: '/analytics/payroll', label: 'Nómina', icon: Users },
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
  const [autoHide, setAutoHide] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem('sidebar-auto-hide') === 'true'
  )
  const [hovered, setHovered] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { config: avatarConfig, setConfig: setAvatarConfig } = useAvatarConfig(user?.uid)
  const { companies, selectedCompany, selectCompany } = useCompany()
  const { can, loading: permissionsLoading } = usePermissions()

  const [openSections, setOpenSections] = useState<Set<string>>(() => getActiveSections(location.pathname))
  const [companyOpen, setCompanyOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const companyRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  const isSettingsRoute = location.pathname.startsWith('/settings')
  const [settingsOpen, setSettingsOpen] = useState(isSettingsRoute)

  const isFinanceRoute = location.pathname.startsWith('/finance')
  const [financeOpen, setFinanceOpen] = useState(isFinanceRoute)

  const isAnalyticsRoute = location.pathname.startsWith('/analytics')
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsRoute)

  // Sync settings panel with route
  useEffect(() => {
    if (isSettingsRoute) setSettingsOpen(true)
    else setSettingsOpen(false)
  }, [isSettingsRoute])

  // Al cambiar de company, limpiar el set de rutas ya prefetcheadas para que el
  // próximo hover dispare el prefetch con el nuevo companyId.
  useEffect(() => {
    resetPrefetchCache()
  }, [selectedCompany?.id])

  // Debounce de 150ms para prefetch on-hover: distingue hover casual (pasar el
  // cursor de A a B en <100ms, no se dispara nada) de hover con intención de
  // click (>150ms, dispara prefetch). Patrón usado por Next.js, React Router v7
  // y GitHub. Evita saturar Firestore con reads que no termina usando el usuario.
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlePrefetchEnter = (path: string) => {
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current)
    prefetchTimerRef.current = setTimeout(() => {
      prefetchRoute(path, selectedCompany?.id)
      prefetchTimerRef.current = null
    }, 150)
  }
  const handlePrefetchLeave = () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current)
      prefetchTimerRef.current = null
    }
  }
  useEffect(() => () => {
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current)
  }, [])

  // Close finance panel when leaving finance routes; don't auto-open
  useEffect(() => {
    if (!isFinanceRoute) setFinanceOpen(false)
  }, [isFinanceRoute])

  // Close analytics panel when leaving analytics routes; don't auto-open
  useEffect(() => {
    if (!isAnalyticsRoute) setAnalyticsOpen(false)
  }, [isAnalyticsRoute])

  // Auto-expand section of active route; collapse previous route's section when switching categories
  const previousPathnameRef = useRef<string | null>(null)
  useEffect(() => {
    const currentPathname = location.pathname
    const currentSections = getActiveSections(currentPathname)
    const previousPathname = previousPathnameRef.current

    setOpenSections(prev => {
      const next = new Set(prev)
      if (previousPathname && previousPathname !== currentPathname) {
        const previousSections = getActiveSections(previousPathname)
        previousSections.forEach(s => {
          if (!currentSections.has(s)) next.delete(s)
        })
      }
      currentSections.forEach(s => next.add(s))
      return next
    })

    previousPathnameRef.current = currentPathname
  }, [location.pathname])

  function toggleSection(title: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  function handleFinanceClick() {
    setFinanceOpen(prev => {
      const next = !prev
      if (next) { setSettingsOpen(false); setAnalyticsOpen(false) }
      return next
    })
  }

  function handleAnalyticsClick() {
    setAnalyticsOpen(prev => {
      const next = !prev
      if (next) { setSettingsOpen(false); setFinanceOpen(false) }
      return next
    })
  }

  function handleSettingsClick() {
    setUserMenuOpen(false)
    if (settingsOpen && isSettingsRoute) {
      setSettingsOpen(false)
      navigate('/home')
    } else if (settingsOpen) {
      setSettingsOpen(false)
    } else {
      setFinanceOpen(false)
      setAnalyticsOpen(false)
      setSettingsOpen(true)
      navigate('/settings/companies')
    }
  }

  // Close dropdowns on outside click / Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node) &&
          userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (companyOpen) { e.preventDefault(); setCompanyOpen(false) }
        if (userMenuOpen) { e.preventDefault(); setUserMenuOpen(false) }
        if (settingsOpen) { e.preventDefault(); setSettingsOpen(false) }
        if (financeOpen) { e.preventDefault(); setFinanceOpen(false) }
        if (analyticsOpen) { e.preventDefault(); setAnalyticsOpen(false) }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKey, true)
    }
  }, [companyOpen, userMenuOpen, settingsOpen, financeOpen, analyticsOpen])

  const effectiveCollapsed = autoHide
    ? !(hovered || companyOpen || userMenuOpen || settingsOpen || financeOpen || analyticsOpen)
    : collapsed

  function toggleAutoHide() {
    const next = !autoHide
    setAutoHide(next)
    localStorage.setItem('sidebar-auto-hide', String(next))
    if (next) {
      setSettingsOpen(false)
      setFinanceOpen(false)
      setAnalyticsOpen(false)
    }
  }

  return (
    <div
      className="flex flex-shrink-0 group/sidebar"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <nav
        className={cn(
          'bg-bone py-5 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out relative border-r border-border/60',
          settingsOpen && 'shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]',
          effectiveCollapsed ? 'w-[14px]' : 'w-[200px]'
        )}
      >
        {/* Collapse toggle — hover-reveal on sidebar edge */}
        {!autoHide && (
          <button
            onClick={() => { if (!collapsed) { setSettingsOpen(false); setFinanceOpen(false); setAnalyticsOpen(false) }; setCollapsed(!collapsed) }}
            className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-bone border border-border shadow-sm flex items-center justify-center text-mid-gray/60 hover:text-graphite hover:bg-smoke opacity-0 group-hover/sidebar:opacity-100 transition-all duration-200 z-20 cursor-pointer"
          >
            <ChevronsLeft size={13} strokeWidth={1.5} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
          </button>
        )}

        {!effectiveCollapsed && (
          <>
            {/* Company selector */}
            <div className="mb-3 px-3" ref={companyRef}>
              <div className="relative">
                <button
                  onClick={() => setCompanyOpen(!companyOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={companyOpen}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-smoke dark:bg-smoke hover:bg-selector-bg dark:hover:bg-selector-bg shadow-sm transition-all duration-150"
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
                  <div
                    role="listbox"
                    className="card-elevated absolute left-0 top-full mt-2 min-w-full w-max max-w-[280px] bg-card-bg rounded-xl z-50 overflow-hidden"
                  >
                    <div className="px-3 pt-2 pb-1 text-caption text-mid-gray">
                      Cambiar compañía
                    </div>
                    <div className="max-h-80 overflow-y-auto py-1">
                      {companies.map((company) => {
                        const isActive = selectedCompany?.id === company.id
                        return (
                          <button
                            key={company.id}
                            role="option"
                            aria-selected={isActive}
                            onClick={() => { selectCompany(company); setCompanyOpen(false) }}
                            className={cn(
                              'relative w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100',
                              isActive ? 'bg-bone' : 'hover:bg-bone/60'
                            )}
                          >
                            {isActive && (
                              <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-graphite" />
                            )}
                            <CompanyLogo company={company} />
                            <div className="min-w-0 flex-1">
                              <div className={cn('text-body truncate leading-tight', isActive ? 'text-dark-graphite font-medium' : 'text-graphite')}>
                                {company.name}
                              </div>
                              {company.location && (
                                <div className="flex items-center gap-1 text-caption text-mid-gray truncate leading-tight mt-0.5">
                                  <MapPin size={10} strokeWidth={1.5} className="shrink-0" />
                                  <span className="truncate">{company.location}</span>
                                </div>
                              )}
                            </div>
                            {isActive && (
                              <Check size={14} strokeWidth={2} className="text-graphite shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Search — inline CommandPalette dropdown */}
            <div className="px-3 mb-3">
              <CommandPalette />
            </div>

            {/* Nav items */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ scrollbarGutter: 'stable both-edges' }}
            >
              {permissionsLoading ? (
                <div className="flex flex-col gap-1">
                  {[3, 5, 2, 2, 1, 1].map((count, sIdx) => (
                    <div key={sIdx} className="flex flex-col gap-1 mb-2">
                      {sIdx > 0 && (
                        <div className="h-8 mx-5 my-1 rounded-md bg-smoke animate-pulse" />
                      )}
                      {Array.from({ length: count }).map((_, i) => (
                        <div key={i} className="h-7 mx-5 rounded-md bg-smoke/70 animate-pulse" />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                NAV_SECTIONS.map((section, sIdx) => {
                  const visibleItems = section.items.filter(({ moduleKey }) => !moduleKey || can(moduleKey, 'read'))
                  if (visibleItems.length === 0) return null

                  const isOpen = !section.title || openSections.has(section.title)
                  return (
                    <div key={section.title ?? sIdx} className={section.title ? 'relative' : ''}>
                      {section.title && (
                        <button
                          onClick={() => toggleSection(section.title!)}
                          className={cn(
                            'group/section w-full flex items-center gap-2.5 py-2.5 px-5 text-body transition-all duration-150',
                            isOpen
                              ? 'text-dark-graphite font-medium'
                              : 'text-graphite/70 hover:bg-card-bg hover:text-graphite'
                          )}
                        >
                          {section.icon && <section.icon size={16} strokeWidth={1.5} />}
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
                      <div
                        className={cn(
                          'grid transition-all duration-200 ease-in-out',
                          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        )}
                      >
                        <div className="overflow-hidden relative">
                          {visibleItems.map(({ to, label, icon: Icon }, itemIdx) => {
                            const isLastItem = itemIdx === visibleItems.length - 1

                            if (to === '/finance' || to === '/analytics') {
                              const isPanelRoute = to === '/finance' ? isFinanceRoute : isAnalyticsRoute
                              const onClick = to === '/finance' ? handleFinanceClick : handleAnalyticsClick
                              return (
                                <button
                                  key={to}
                                  onClick={onClick}
                                  onMouseEnter={() => handlePrefetchEnter(to)}
                                  onMouseLeave={handlePrefetchLeave}
                                  onFocus={() => prefetchRoute(to, selectedCompany?.id)}
                                  className={cn(
                                    'group/nav relative flex items-center gap-2.5 py-2.5 text-body transition-all duration-150 w-full',
                                    section.title ? 'pl-8 pr-5' : 'px-5',
                                    isPanelRoute
                                      ? 'text-dark-graphite font-medium bg-bone border-r-2 border-graphite'
                                      : 'text-graphite/70 hover:bg-card-bg hover:text-graphite'
                                  )}
                                >
                                  {section.title && (
                                    <>
                                      <div className="absolute left-[27px] top-0 h-1/2 w-[4px] border-l-[1.5px] border-b-[1.5px] border-graphite/20 rounded-bl-[4px]" />
                                      {!isLastItem && <div className="absolute left-[27px] top-1/2 bottom-0 w-[1.5px] bg-graphite/20" />}
                                    </>
                                  )}
                                  <Icon size={16} strokeWidth={1.5} />
                                  {label}
                                </button>
                              )
                            }
                            return (
                              <NavLink
                                key={to}
                                to={to}
                                onClick={onNavClick}
                                onMouseEnter={() => handlePrefetchEnter(to)}
                                onMouseLeave={handlePrefetchLeave}
                                onFocus={() => prefetchRoute(to, selectedCompany?.id)}
                                className={({ isActive }) =>
                                  cn(
                                    'group/nav relative flex items-center gap-2.5 py-2.5 text-body transition-all duration-150',
                                    section.title ? 'pl-8 pr-5' : 'px-5',
                                    isActive
                                      ? 'text-dark-graphite font-medium bg-bone border-r-2 border-graphite'
                                      : 'text-graphite/70 hover:bg-card-bg hover:text-graphite'
                                  )
                                }
                              >
                                {section.title && (
                                  <>
                                    <div className="absolute left-[27px] top-0 h-1/2 w-[4px] border-l-[1.5px] border-b-[1.5px] border-graphite/20 rounded-bl-[4px]" />
                                    {!isLastItem && <div className="absolute left-[27px] top-1/2 bottom-0 w-[1.5px] bg-graphite/20" />}
                                  </>
                                )}
                                <Icon size={16} strokeWidth={1.5} />
                                {label}
                              </NavLink>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Bottom — Notifications + User menu */}
            <div className="border-t border-border mx-4 pt-1">
              <div className="flex items-center justify-between py-2 px-1">
                <button
                  onClick={toggleAutoHide}
                  className="p-1.5 rounded-md text-mid-gray/60 hover:text-graphite hover:bg-smoke transition-colors duration-150 cursor-pointer"
                  title={autoHide ? 'Fijar sidebar' : 'Auto-ocultar sidebar'}
                  aria-label={autoHide ? 'Fijar sidebar' : 'Auto-ocultar sidebar'}
                >
                  {autoHide
                    ? <LockOpen size={15} strokeWidth={1.5} />
                    : <Lock size={15} strokeWidth={1.5} />}
                </button>
                <NotificationBell
                  dropdownPosition="fixed"
                  fixedStyle={{ bottom: 60, left: 208 }}
                />
              </div>

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-smoke dark:bg-smoke hover:bg-selector-bg dark:hover:bg-selector-bg shadow-sm transition-all duration-150 cursor-pointer"
                >
                  <UserAvatar config={avatarConfig} displayName={user?.displayName} email={user?.email} size="md" />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-body font-medium text-dark-graphite truncate">{user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuario'}</div>
                    <div className="text-[11px] text-mid-gray truncate leading-tight">{user?.email ?? ''}</div>
                  </div>
                </button>

                {/* User dropdown — opens to the right of sidebar */}
                {userMenuOpen && (
                  <div
                    ref={userDropdownRef}
                    className="fixed bottom-4 z-50 w-[250px] animate-in fade-in slide-in-from-left-2 duration-200"
                    style={{ left: 208 }}
                  >
                    <div className="bg-bone border border-border rounded-xl shadow-lg p-2">
                      {/* Main card */}
                      <div className="bg-surface-elevated rounded-lg border border-border/60 shadow-sm">
                        {/* User info header */}
                        <div className="flex items-center gap-3 px-4 py-4">
                          <UserAvatar config={avatarConfig} displayName={user?.displayName} email={user?.email} size="lg" />
                          <div className="min-w-0">
                            <div className="text-body font-medium text-dark-graphite truncate">{user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuario'}</div>
                            <div className="text-caption text-mid-gray truncate">{user?.email ?? ''}</div>
                          </div>
                        </div>
                        <div className="border-t border-border/60" />
                        <AvatarPicker config={avatarConfig} onConfigChange={setAvatarConfig} />
                        <div className="border-t border-border/60" />
                        <ThemeToggle />
                        <div className="border-t border-border/60" />
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            navigate('/')
                          }}
                          onMouseEnter={() => prefetchSelectorSales(companies)}
                          onFocus={() => prefetchSelectorSales(companies)}
                          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-body text-mid-gray hover:text-dark-graphite transition-colors duration-150"
                        >
                          <LayoutGrid size={16} strokeWidth={1.5} />
                          Mis compañías
                        </button>
                        {can('settings', 'read') && (
                          <>
                            <div className="border-t border-border/60" />
                            {/* Configuración button — opens side panel */}
                            <button
                              onClick={handleSettingsClick}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-body transition-colors duration-150',
                                settingsOpen
                                  ? 'text-dark-graphite font-medium'
                                  : 'text-mid-gray hover:text-dark-graphite'
                              )}
                            >
                              <Settings size={16} strokeWidth={1.5} />
                              Configuración
                            </button>
                          </>
                        )}
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
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Finance sub-panel */}
      <div
        className={cn(
          'bg-card-bg border-r border-border flex flex-col py-5 overflow-hidden transition-all duration-300 ease-in-out',
          financeOpen ? 'w-[200px] opacity-100' : 'w-0 opacity-0'
        )}
      >
        <div className="px-4 mb-4">
          <h3 className="text-caption uppercase tracking-wider text-mid-gray font-medium">Finanzas</h3>
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          {FINANCE_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => { onNavClick?.(); setFinanceOpen(false) }}
              onMouseEnter={() => prefetchRoute(to, selectedCompany?.id)}
              onFocus={() => prefetchRoute(to, selectedCompany?.id)}
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
            onClick={() => setFinanceOpen(false)}
            className="group/close relative flex items-center justify-center p-1.5 rounded-md text-mid-gray/50 hover:text-graphite transition-colors duration-200"
          >
            <ChevronsLeft size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Analytics sub-panel */}
      <div
        className={cn(
          'bg-card-bg border-r border-border flex flex-col py-5 overflow-hidden transition-all duration-300 ease-in-out',
          analyticsOpen ? 'w-[200px] opacity-100' : 'w-0 opacity-0'
        )}
      >
        <div className="px-4 mb-4">
          <h3 className="text-caption uppercase tracking-wider text-mid-gray font-medium">Análisis</h3>
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          {ANALYTICS_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => { onNavClick?.(); setAnalyticsOpen(false) }}
              onMouseEnter={() => prefetchRoute(to, selectedCompany?.id)}
              onFocus={() => prefetchRoute(to, selectedCompany?.id)}
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
            onClick={() => setAnalyticsOpen(false)}
            className="group/close relative flex items-center justify-center p-1.5 rounded-md text-mid-gray/50 hover:text-graphite transition-colors duration-200"
          >
            <ChevronsLeft size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>

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
              onMouseEnter={() => prefetchRoute(to, selectedCompany?.id)}
              onFocus={() => prefetchRoute(to, selectedCompany?.id)}
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
