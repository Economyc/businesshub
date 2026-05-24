import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { AdminSidebar } from './sidebar'

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Topbar móvil con hamburguesa (oculto en desktop) */}
      <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-card-bg shrink-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-graphite hover:bg-bone transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        <span className="text-subheading text-dark-graphite">BusinessHub</span>
      </header>

      {/* Sidebar fijo en desktop */}
      <div className="hidden md:flex h-full">
        <AdminSidebar />
      </div>

      {/* Drawer en móvil */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 animate-in slide-in-from-left duration-200">
            <AdminSidebar mobile onNavClick={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-y-auto bg-background relative z-10 p-4 md:p-6 pb-8">
        <Outlet />
      </main>
    </div>
  )
}
