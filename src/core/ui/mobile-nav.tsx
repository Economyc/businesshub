import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, Users, Briefcase, DollarSign, Settings, Home, Handshake, ClipboardList, FileSignature, X, ChevronRight, Building2, Tags, BadgeCheck, Network, ChevronsUpDown, Check, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { CompanyLogo } from '@/core/ui/company-logo'

const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/talent', label: 'Talento', icon: Users },
  { to: '/suppliers', label: 'Proveedores', icon: Briefcase },
  { to: '/finance', label: 'Finanzas', icon: DollarSign },
  { to: '/partners', label: 'Socios', icon: Handshake },
  { to: '/closings', label: 'Cierres', icon: ClipboardList },
  { to: '/contracts', label: 'Contratos', icon: FileSignature },
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

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { companies, selectedCompany, selectCompany } = useCompany()
  const [companyOpen, setCompanyOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const location = useLocation()

  function handleNav() {
    onClose()
    setSettingsOpen(false)
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
            className="fixed inset-y-0 left-0 w-[85vw] max-w-[320px] bg-surface-elevated flex flex-col shadow-2xl"
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
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
            </div>

            {/* Settings */}
            <div className="border-t border-border">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={cn(
                  'w-full flex items-center gap-3 px-6 py-3.5 text-[15px] transition-all duration-150',
                  settingsOpen || location.pathname.startsWith('/settings')
                    ? 'text-dark-graphite font-medium'
                    : 'text-graphite/70'
                )}
              >
                <Settings size={20} strokeWidth={1.5} />
                <span className="flex-1 text-left">Configuración</span>
                <ChevronRight
                  size={16}
                  strokeWidth={1.5}
                  className={cn('text-mid-gray transition-transform duration-200', settingsOpen && 'rotate-90')}
                />
              </button>

              <AnimatePresence>
                {settingsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-3 space-y-0.5">
                      {SETTINGS_ITEMS.map(({ to, label, icon: Icon }) => (
                        <NavLink
                          key={to}
                          to={to}
                          onClick={handleNav}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 mx-3 px-3 pl-10 py-2.5 rounded-xl text-body transition-all duration-150',
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
