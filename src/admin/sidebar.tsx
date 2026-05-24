import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronsLeft, ChevronsUpDown, Check, MapPin, LogOut, Lock, LockOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HoverHint } from '@/components/ui/tooltip'
import { CompanyLogo } from '@/core/ui/company-logo'
import { AvatarPicker } from '@/core/ui/avatar-picker'
import { UserAvatar } from '@/core/ui/user-avatar'
import { useAuth } from '@/core/hooks/use-auth'
import { useAvatarConfig } from '@/core/hooks/use-avatar-config'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { ADMIN_NAV } from './nav'

interface AdminSidebarProps {
  /** Cierra el drawer al navegar (sólo en variante móvil). */
  onNavClick?: () => void
  /** Variante drawer para pantallas pequeñas: ancho fijo, sin colapso ni auto-hide. */
  mobile?: boolean
  /** Cerrar el drawer (botón X, sólo móvil). */
  onClose?: () => void
}

// Sidebar de App2 (operación de local). Replica la estética y el comportamiento
// del sidebar de App1 (src/core/ui/sidebar.tsx): bg-bone 200px, colapsable con
// botón flotante en el borde, auto-hide opcional persistido en localStorage,
// selector de compañía estilo pill con dropdown lateral y menú de usuario con
// avatar al fondo. En móvil se monta como drawer (prop `mobile`): ancho fijo,
// siempre expandido, dropdowns anclados dentro del propio panel.
// Se podan las piezas que no aplican a App2 (command palette, sub-paneles
// Finance/Settings, secciones colapsables, notification bell).
export function AdminSidebar({ onNavClick, mobile = false, onClose }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [autoHide, setAutoHide] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem('admin-sidebar-auto-hide') === 'true'
  )
  const [hovered, setHovered] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { config: avatarConfig, setConfig: setAvatarConfig } = useAvatarConfig(user?.uid)
  const { companies, selectedCompany, selectCompany } = useCompany()
  const { canAccessPage, loading: permissionsLoading } = usePermissions()

  const [companyOpen, setCompanyOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const companyRef = useRef<HTMLDivElement>(null)
  const companyDropdownRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  const items = ADMIN_NAV.filter((i) => canAccessPage(i.pageId))

  // Cerrar dropdowns al click fuera / Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node) &&
          (!companyDropdownRef.current || !companyDropdownRef.current.contains(e.target as Node))) {
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
        else if (userMenuOpen) { e.preventDefault(); setUserMenuOpen(false) }
        else if (mobile && onClose) { e.preventDefault(); onClose() }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKey, true)
    }
  }, [companyOpen, userMenuOpen, mobile, onClose])

  // En móvil el panel está siempre expandido; el colapso/auto-hide es sólo desktop.
  const effectiveCollapsed = mobile
    ? false
    : autoHide
      ? !(hovered || companyOpen || userMenuOpen)
      : collapsed

  function toggleAutoHide() {
    const next = !autoHide
    setAutoHide(next)
    localStorage.setItem('admin-sidebar-auto-hide', String(next))
  }

  return (
    <div
      className={cn('flex flex-shrink-0 group/sidebar', mobile && 'h-full')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <nav
        className={cn(
          'bg-bone py-5 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out relative border-r border-border/60',
          mobile ? 'w-[280px] h-full' : effectiveCollapsed ? 'w-[14px]' : 'w-[200px]'
        )}
      >
        {/* Collapse toggle — hover-reveal on sidebar edge (sólo desktop) */}
        {!mobile && !autoHide && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-bone border border-border shadow-sm flex items-center justify-center text-mid-gray/60 hover:text-graphite hover:bg-smoke opacity-0 group-hover/sidebar:opacity-100 transition-all duration-200 z-20 cursor-pointer"
          >
            <ChevronsLeft size={13} strokeWidth={1.5} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
          </button>
        )}

        {!effectiveCollapsed && (
          <>
            {/* Botón cerrar (sólo móvil) */}
            {mobile && (
              <div className="flex justify-end px-3 -mt-2 mb-1">
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-mid-gray hover:text-graphite hover:bg-smoke transition-colors"
                  aria-label="Cerrar menú"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>
            )}

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
                    {selectedCompany?.location ? (
                      <div className="flex items-center gap-0.5 text-body font-medium text-dark-graphite truncate">
                        <MapPin size={11} />
                        {selectedCompany.location}
                      </div>
                    ) : (
                      <div className="text-body font-medium text-dark-graphite truncate">
                        {selectedCompany?.name ?? 'Empresa'}
                      </div>
                    )}
                  </div>
                  <ChevronsUpDown size={14} className="text-mid-gray shrink-0" />
                </button>

                {companyOpen && (
                  <div
                    ref={companyDropdownRef}
                    role="listbox"
                    className={cn(
                      'card-elevated z-50 min-w-[240px] max-w-[280px] bg-card-bg rounded-xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200',
                      mobile ? 'absolute left-0 right-0 top-full mt-1' : 'fixed top-4'
                    )}
                    style={mobile ? undefined : { left: 208 }}
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

            {/* Nav items */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ scrollbarGutter: 'stable both-edges' }}
            >
              {permissionsLoading ? (
                <div className="flex flex-col gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-9 mx-3 rounded-lg bg-smoke/70 animate-pulse" />
                  ))}
                </div>
              ) : (
                items.map(({ path, label }) => (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={onNavClick}
                    className={({ isActive }) =>
                      cn(
                        'group/nav relative flex items-center px-3 mx-2 py-2.5 rounded-lg text-body transition-all duration-150',
                        isActive
                          ? 'text-dark-graphite font-medium bg-smoke'
                          : 'text-graphite/70 hover:bg-card-bg hover:text-graphite'
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ))
              )}
            </div>

            {/* Bottom — auto-hide toggle + User menu */}
            <div className="border-t border-border mx-4 pt-1">
              {!mobile && (
                <div className="flex items-center py-2 px-1">
                  <HoverHint label={autoHide ? 'Fijar sidebar' : 'Auto-ocultar sidebar'} side="right">
                    <button
                      onClick={toggleAutoHide}
                      className="p-1.5 rounded-md text-mid-gray/60 hover:text-graphite hover:bg-smoke transition-colors duration-150 cursor-pointer"
                      aria-label={autoHide ? 'Fijar sidebar' : 'Auto-ocultar sidebar'}
                    >
                      {autoHide
                        ? <LockOpen size={15} strokeWidth={1.5} />
                        : <Lock size={15} strokeWidth={1.5} />}
                    </button>
                  </HoverHint>
                </div>
              )}

              <div className={cn('relative', mobile ? 'mt-2' : '')} ref={userMenuRef}>
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

                {/* User dropdown — abre a la derecha (desktop) o sobre el botón (móvil) */}
                {userMenuOpen && (
                  <div
                    ref={userDropdownRef}
                    className={cn(
                      'z-50 w-[250px] animate-in fade-in slide-in-from-left-2 duration-200',
                      mobile ? 'absolute bottom-full left-0 right-0 mb-2 w-auto' : 'fixed bottom-4'
                    )}
                    style={mobile ? undefined : { left: 208 }}
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
                      </div>

                      {/* Logout sub-card */}
                      <div className="mt-2 bg-surface/60 rounded-lg border border-border/60">
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            logout()
                            navigate('/login')
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
    </div>
  )
}
