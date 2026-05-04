import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Briefcase, DollarSign, Home, Handshake, ClipboardList, FileSignature, X, ChevronRight, Building2, Tags, BadgeCheck, Network, ChevronsUpDown, Check, MapPin, Wallet, Receipt, Gift, LogOut, List, ShoppingCart, Package, Target, Scale, FileText, Megaphone, RefreshCw, Shield, LayoutDashboard, Store, PieChart, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { usePermissions } from '@/core/hooks/use-permissions'
import { CompanyLogo } from '@/core/ui/company-logo'
import { ThemeToggle } from '@/core/ui/theme-toggle'
import { AvatarPicker } from '@/core/ui/avatar-picker'
import { UserAvatar } from '@/core/ui/user-avatar'
import { useAvatarConfig } from '@/core/hooks/use-avatar-config'
import type { ModuleKey } from '@/core/types/permissions'

interface NavItem {
  to: string
  label: string
  icon?: typeof Home
  moduleKey?: ModuleKey
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/home', label: 'Home', moduleKey: 'home' },
      { to: '/agent', label: 'Asistente AI', moduleKey: 'agent' },
      { to: '/analytics', label: 'Análisis', moduleKey: 'analytics' },
    ],
  },
  {
    title: 'Contabilidad',
    items: [
      { to: '/finance', label: 'Finanzas', icon: DollarSign, moduleKey: 'finance' },
      { to: '/cartera', label: 'Cartera', icon: Wallet, moduleKey: 'cartera' },
      { to: '/closings', label: 'Cierres de Caja', icon: ClipboardList, moduleKey: 'closings' },
      { to: '/payroll', label: 'Nomina', icon: Receipt, moduleKey: 'payroll' },
      { to: '/prestaciones', label: 'Prestaciones', icon: Gift, moduleKey: 'prestaciones' },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/contracts', label: 'Contratos', icon: FileSignature, moduleKey: 'contracts' },
      { to: '/partners', label: 'Socios', icon: Handshake, moduleKey: 'partners' },
      { to: '/talent', label: 'Equipo', icon: Users, moduleKey: 'talent' },
      { to: '/suppliers', label: 'Proveedores', icon: Briefcase, moduleKey: 'suppliers' },
    ],
  },
  {
    title: 'Mercadeo',
    items: [
      { to: '/marketing/influencers', label: 'Influencers', icon: Megaphone, moduleKey: 'marketing' },
    ],
  },
  {
    title: 'Integraciones',
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

const FINANCE_ITEMS: (Omit<NavItem, 'icon'> & { icon: typeof Home; end?: boolean })[] = [
  { to: '/finance', label: 'Transacciones', icon: List, end: true },
  { to: '/finance/purchases', label: 'Compras', icon: ShoppingCart, end: true },
  { to: '/finance/purchases/products', label: 'Insumos', icon: Package },
  { to: '/finance/cash-flow', label: 'Flujo de Caja', icon: Wallet },
  { to: '/finance/income-statement', label: 'Estado de Resultados', icon: FileText },
  { to: '/finance/budget', label: 'Presupuesto', icon: Target },
  { to: '/finance/reconciliation', label: 'Conciliacion', icon: Scale },
]

const ANALYTICS_ITEMS: (Omit<NavItem, 'icon'> & { icon: typeof Home; end?: boolean })[] = [
  { to: '/analytics', label: 'General', icon: LayoutDashboard, end: true },
  { to: '/analytics/pos', label: 'POS', icon: Store },
  { to: '/analytics/costs', label: 'Costos', icon: PieChart },
  { to: '/analytics/purchases', label: 'Compras', icon: ShoppingCart },
  { to: '/analytics/payroll', label: 'Nómina', icon: Users },
]

interface MobileNavProps {
  open: boolean
  onClose: () => void
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

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { companies, selectedCompany, selectCompany } = useCompany()
  const { user, logout } = useAuth()
  const { can } = usePermissions()
  const { config: avatarConfig, setConfig: setAvatarConfig } = useAvatarConfig(user?.uid)
  const location = useLocation()
  const isFinanceRoute = location.pathname.startsWith('/finance')
  const isAnalyticsRoute = location.pathname.startsWith('/analytics')
  const [companyOpen, setCompanyOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [financeExpanded, setFinanceExpanded] = useState(isFinanceRoute)
  const [analyticsExpanded, setAnalyticsExpanded] = useState(isAnalyticsRoute)
  const [openSections, setOpenSections] = useState<Set<string>>(() => getActiveSections(location.pathname))

  // Auto-expand section when navigating
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

  // Close finance submenu when navigating away from finance routes
  useEffect(() => {
    if (!isFinanceRoute) setFinanceExpanded(false)
    else setFinanceExpanded(true)
  }, [location.pathname, isFinanceRoute])

  // Close analytics submenu when navigating away from analytics routes
  useEffect(() => {
    if (!isAnalyticsRoute) setAnalyticsExpanded(false)
    else setAnalyticsExpanded(true)
  }, [location.pathname, isAnalyticsRoute])

  function toggleSection(title: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  function handleNav() {
    onClose()
    setUserMenuOpen(false)
    setCompanyOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.nav
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-y-0 left-0 w-[85vw] max-w-[320px] bg-surface-elevated flex flex-col shadow-2xl overflow-hidden"
            style={{ touchAction: 'pan-y', overscrollBehaviorX: 'none' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="text-subheading font-bold text-dark-graphite tracking-tight">
                Business<span className="font-light text-mid-gray">Hub</span>
              </span>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Company switcher */}
            <div className="px-4 py-3 border-b border-border">
              <button
                onClick={() => setCompanyOpen(!companyOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bone/60 border border-border"
              >
                <CompanyLogo company={selectedCompany} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-body font-medium text-dark-graphite truncate">
                    {selectedCompany?.name ?? 'BusinessHub'}
                  </div>
                  {selectedCompany?.location && (
                    <div className="flex items-center gap-0.5 text-caption text-mid-gray">
                      <MapPin size={10} />
                      {selectedCompany.location}
                    </div>
                  )}
                </div>
                <ChevronsUpDown size={14} className="text-mid-gray shrink-0" />
              </button>

              <AnimatePresence>
                {companyOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 space-y-0.5">
                      {companies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => { selectCompany(company); setCompanyOpen(false) }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                            selectedCompany?.id === company.id ? 'bg-bone' : 'hover:bg-bone/50'
                          )}
                        >
                          <CompanyLogo company={company} />
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-body text-dark-graphite truncate">{company.name}</div>
                            {company.location && (
                              <div className="flex items-center gap-0.5 text-caption text-mid-gray truncate">
                                <MapPin size={10} className="shrink-0" />
                                <span className="truncate">{company.location}</span>
                              </div>
                            )}
                          </div>
                          {selectedCompany?.id === company.id && (
                            <Check size={14} className="text-graphite shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-2" style={{ touchAction: 'pan-y', overscrollBehaviorX: 'none' }}>
              {NAV_SECTIONS.map((section, sIdx) => {
                const visibleItems = section.items.filter(({ moduleKey }) => !moduleKey || can(moduleKey, 'read'))
                if (visibleItems.length === 0) return null

                const isOpen = !section.title || openSections.has(section.title)
                return (
                  <div key={section.title ?? sIdx}>
                    {section.title && (
                      <button
                        onClick={() => toggleSection(section.title!)}
                        className={cn(
                          'w-full flex items-center gap-2.5 mx-3 px-3 py-2.5 mt-2 rounded-xl text-body transition-all duration-150 group/section',
                          isOpen
                            ? 'text-dark-graphite font-medium'
                            : 'text-graphite/70 active:bg-bone/50'
                        )}
                      >
                        <span className="flex-1 text-left">{section.title}</span>
                        <ChevronRight
                          size={14}
                          strokeWidth={1.5}
                          className={cn(
                            'mr-1 text-mid-gray/40 group-hover/section:text-mid-gray transition-all duration-200',
                            isOpen && 'rotate-90'
                          )}
                        />
                      </button>
                    )}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          {visibleItems.map(({ to, label, icon: Icon }) => {
                            const inSection = !!section.title
                            const itemClass = inSection
                              ? 'flex items-center gap-3 mx-3 px-3 pl-9 py-2.5 rounded-xl text-body transition-all duration-150'
                              : 'flex items-center gap-3 mx-3 px-3 py-3 rounded-xl text-body transition-all duration-150'
                            const subItemClass = inSection
                              ? 'flex items-center gap-3 mx-3 px-3 pl-14 py-2.5 rounded-xl text-body transition-all duration-150'
                              : 'flex items-center gap-3 mx-3 px-3 pl-9 py-2.5 rounded-xl text-body transition-all duration-150'

                            if (to === '/finance' || to === '/analytics') {
                              const isExpanded = to === '/finance' ? financeExpanded : analyticsExpanded
                              const setExpanded = to === '/finance' ? setFinanceExpanded : setAnalyticsExpanded
                              const subItems = to === '/finance' ? FINANCE_ITEMS : ANALYTICS_ITEMS
                              const isOnRoute = location.pathname.startsWith(to)
                              return (
                                <div key={to}>
                                  <button
                                    onClick={() => setExpanded(!isExpanded)}
                                    className={cn(
                                      'w-full ' + itemClass,
                                      isOnRoute
                                        ? 'text-dark-graphite font-medium bg-smoke'
                                        : 'text-graphite/70 active:bg-bone/50'
                                    )}
                                  >
                                    {Icon && <Icon size={16} strokeWidth={1.5} />}
                                    {label}
                                    <ChevronRight
                                      size={14}
                                      className={cn('ml-auto mr-1 text-mid-gray transition-transform duration-200', isExpanded && 'rotate-90')}
                                    />
                                  </button>
                                  <AnimatePresence initial={false}>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        {subItems.map((si) => (
                                          <NavLink
                                            key={si.to}
                                            to={si.to}
                                            end={si.end}
                                            onClick={handleNav}
                                            className={({ isActive }) =>
                                              cn(
                                                subItemClass,
                                                isActive
                                                  ? 'text-dark-graphite font-medium bg-bone'
                                                  : 'text-graphite/70 active:bg-bone/50'
                                              )
                                            }
                                          >
                                            <si.icon size={16} strokeWidth={1.5} />
                                            {si.label}
                                          </NavLink>
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )
                            }
                            return (
                              <NavLink
                                key={to}
                                to={to}
                                onClick={handleNav}
                                className={({ isActive }) =>
                                  cn(
                                    itemClass,
                                    isActive
                                      ? 'text-dark-graphite font-medium bg-smoke'
                                      : 'text-graphite/70 active:bg-bone/50'
                                  )
                                }
                              >
                                {Icon && <Icon size={16} strokeWidth={1.5} />}
                                {label}
                              </NavLink>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* User card with settings */}
            <div className="border-t border-border">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-3 px-6 py-3.5 text-[15px] transition-all duration-150 text-dark-graphite"
              >
                <UserAvatar config={avatarConfig} displayName={user?.displayName} email={user?.email} size="md" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-body font-medium text-dark-graphite truncate">{user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuario'}</div>
                  <div className="text-caption text-mid-gray truncate">{user?.email ?? ''}</div>
                </div>
                <ChevronRight
                  size={16}
                  strokeWidth={1.5}
                  className={cn('text-mid-gray transition-transform duration-200', userMenuOpen && 'rotate-90')}
                />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-3 px-3 space-y-0.5">
                      <AvatarPicker config={avatarConfig} onConfigChange={setAvatarConfig} />
                      <div className="mx-3 my-1 border-t border-border/60" />
                      <ThemeToggle />
                      <div className="mx-3 my-1 border-t border-border/60" />
                      <NavLink
                        to="/"
                        onClick={handleNav}
                        className="flex items-center gap-3 px-3 pl-6 py-2.5 rounded-xl text-body text-graphite/70 active:bg-bone/50 transition-all duration-150"
                      >
                        <LayoutGrid size={16} strokeWidth={1.5} />
                        Mis compañías
                      </NavLink>
                      {can('settings', 'read') && (
                        <>
                          <div className="mx-3 my-1 border-t border-border/60" />
                          <div className="px-3 pt-1 pb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-mid-gray/60">Configuración</span>
                          </div>
                          {SETTINGS_ITEMS.map(({ to, label, icon: Icon }) => (
                            <NavLink
                              key={to}
                              to={to}
                              onClick={handleNav}
                              className={({ isActive }) =>
                                cn(
                                  'flex items-center gap-3 px-3 pl-6 py-2.5 rounded-xl text-body transition-all duration-150',
                                  isActive
                                    ? 'text-dark-graphite font-medium bg-bone'
                                    : 'text-graphite/70 active:bg-bone/50'
                                )
                              }
                            >
                              <Icon size={16} strokeWidth={1.5} />
                              {label}
                            </NavLink>
                          ))}
                        </>
                      )}
                      <div className="mx-3 my-1 border-t border-border/60" />
                      <button
                        onClick={() => {
                          handleNav()
                          logout()
                        }}
                        className="w-full flex items-center gap-3 px-3 pl-6 py-2.5 rounded-xl text-body text-mid-gray hover:text-dark-graphite transition-colors duration-150"
                      >
                        <LogOut size={16} strokeWidth={1.5} />
                        Cerrar sesión
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  )
}
