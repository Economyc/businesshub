import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, Users, Briefcase, DollarSign, Home, Handshake, ClipboardList, FileSignature, X, ChevronRight, Building2, Tags, BadgeCheck, Network, ChevronsUpDown, Check, MapPin, Wallet, Receipt, Gift, CircleUser, LogOut, Bot, Landmark, Boxes, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { CompanyLogo } from '@/core/ui/company-logo'
import { ThemeToggle } from '@/core/ui/theme-toggle'

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
      { to: '/agent', label: 'Asistente AI', icon: Bot },
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
    title: 'Gestión',
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
  const [companyOpen, setCompanyOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(() => getActiveSections(window.location.pathname))
  const location = useLocation()

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
            className="fixed inset-y-0 left-0 w-[85vw] max-w-[320px] bg-surface-elevated flex flex-col shadow-2xl overflow-x-hidden touch-pan-y"
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
            <div className="flex-1 overflow-y-auto py-2">
              {NAV_SECTIONS.map((section, sIdx) => {
                const isOpen = !section.title || openSections.has(section.title)
                return (
                  <div key={section.title ?? sIdx}>
                    {section.title && (
                      <button
                        onClick={() => toggleSection(section.title!)}
                        className={cn(
                          'w-full flex items-center gap-2.5 mx-3 px-3 py-2.5 mt-2 rounded-xl text-[15px] transition-all duration-150 group/section',
                          isOpen
                            ? 'text-dark-graphite font-medium'
                            : 'text-graphite/70 active:bg-bone/50'
                        )}
                      >
                        {section.icon && <section.icon size={20} strokeWidth={1.5} />}
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
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden relative"
                        >
                          {/* Tree connector line */}
                          {section.title && (
                            <div className="absolute left-[30px] top-0 bottom-0 w-px bg-border" />
                          )}
                          {section.items.map(({ to, label, icon: Icon }) => (
                            <NavLink
                              key={to}
                              to={to}
                              onClick={handleNav}
                              className={({ isActive }) =>
                                cn(
                                  'flex items-center gap-3 mx-3 px-3 py-3 rounded-xl text-[15px] transition-all duration-150',
                                  isActive
                                    ? 'text-dark-graphite font-medium bg-bone'
                                    : 'text-graphite/70 active:bg-bone/50'
                                )
                              }
                            >
                              <Icon size={20} strokeWidth={1.5} />
                              {label}
                            </NavLink>
                          ))}
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
                <div className="w-8 h-8 rounded-full bg-graphite/10 flex items-center justify-center shrink-0">
                  <CircleUser size={18} strokeWidth={1.5} className="text-graphite" />
                </div>
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
                      <ThemeToggle />
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
