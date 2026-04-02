import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CircleUser, LogOut, Menu, ChevronsUpDown, Check, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/core/ui/theme-toggle'
import { CompanyLogo } from '@/core/ui/company-logo'
import { useAuth } from '@/core/hooks/use-auth'
import { useCompany } from '@/core/hooks/use-company'

interface TopbarProps {
  onMenuToggle?: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth()
  const { companies, selectedCompany, selectCompany } = useCompany()
  const [open, setOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const companyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (open) { e.preventDefault(); setOpen(false) }
        if (companyOpen) { e.preventDefault(); setCompanyOpen(false) }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKey, true)
    }
  }, [open, companyOpen])

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3.5 bg-card-bg border-b border-border">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-1.5 rounded-lg text-graphite hover:bg-bone transition-colors"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>

        {/* Mobile: BusinessHub logo */}
        <Link to="/home" className="md:hidden text-heading font-bold text-dark-graphite tracking-tight hover:opacity-70 transition-opacity">
          Business<span className="font-light text-mid-gray">Hub</span>
        </Link>

        {/* Desktop: Company selector */}
        <div className="hidden md:block relative" ref={companyRef}>
          <button
            onClick={() => setCompanyOpen(!companyOpen)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-[#f4f3f1] dark:bg-[#171717] hover:bg-[#eeedeb] dark:hover:bg-[#1c1c1c] transition-all duration-150"
          >
            <CompanyLogo company={selectedCompany} />
            <div className="min-w-0 text-left">
              <div className="text-body font-medium text-dark-graphite truncate max-w-[180px]">
                {selectedCompany?.name ?? 'BusinessHub'}
              </div>
              {selectedCompany?.location && (
                <div className="flex items-center gap-0.5 text-[11px] text-mid-gray truncate">
                  <MapPin size={9} />
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
      </div>

      <div className="flex items-center gap-2.5">
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f4f3f1] dark:bg-[#171717] hover:bg-[#eeedeb] dark:hover:bg-[#1c1c1c] transition-all duration-150 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-full bg-graphite/10 flex items-center justify-center">
            <CircleUser size={14} strokeWidth={1.5} className="text-graphite" />
          </div>
          <span className="text-body font-medium text-dark-graphite truncate max-w-[120px]">{user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuario'}</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-[250px] bg-bone border border-border rounded-xl shadow-lg z-50 p-2">
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
            </div>

            {/* Logout sub-card */}
            <div className="mt-2 bg-surface/60 rounded-lg border border-border/60">
              <button
                onClick={() => {
                  setOpen(false)
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
      </div>
    </header>
  )
}
