import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CircleUser, LogOut, Menu } from 'lucide-react'
import { ThemeToggle } from '@/core/ui/theme-toggle'
import { useAuth } from '@/core/hooks/use-auth'

interface TopbarProps {
  onMenuToggle?: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKey, true)
    }
  }, [open])

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3.5 bg-card-bg border-b border-border">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-1.5 rounded-lg text-graphite hover:bg-bone transition-colors"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        <Link to="/home" className="text-heading font-bold text-dark-graphite tracking-tight hover:opacity-70 transition-opacity">
          Business<span className="font-light text-mid-gray">Hub</span>
        </Link>
      </div>

      <div className="flex items-center gap-2.5">
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border-hover bg-selector-bg shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_3px_rgba(255,255,255,0.03)] dark:hover:shadow-[0_1px_4px_rgba(255,255,255,0.06)] hover:border-mid-gray/40 transition-all duration-150 cursor-pointer"
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
