import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Topbar } from './topbar'
import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'
import { Breadcrumb } from './breadcrumb'

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col">
      {/* Mobile-only topbar */}
      <div className="md:hidden">
        <Topbar onMenuToggle={() => setMobileMenuOpen(true)} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex h-full">
          <Sidebar />
        </div>

        {/* Mobile navigation drawer */}
        <MobileNav open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-14">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
