import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Topbar } from './topbar'
import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col">
      <Topbar onMenuToggle={() => setMobileMenuOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex h-full">
          <Sidebar />
        </div>

        {/* Mobile navigation drawer */}
        <MobileNav open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-14">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
