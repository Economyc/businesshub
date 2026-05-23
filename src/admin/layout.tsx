import { NavLink, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/core/hooks/use-auth'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { SelectInput } from '@/core/ui/select-input'
import { ADMIN_NAV } from './nav'

export function AdminLayout() {
  const { user, logout } = useAuth()
  const { companies, selectedCompany, selectCompany } = useCompany()
  const { canAccessPage } = usePermissions()

  const items = ADMIN_NAV.filter((i) => canAccessPage(i.pageId))

  return (
    <div className="flex min-h-screen bg-bone">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border/60 bg-card-bg flex flex-col">
        <div className="px-4 py-4 border-b border-border/60">
          <p className="text-subheading text-graphite">BusinessHub</p>
          <p className="text-caption text-mid-gray">Operación de local</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-body transition-colors',
                    isActive
                      ? 'bg-graphite text-bone'
                      : 'text-graphite hover:bg-bone',
                  )
                }
              >
                <Icon size={18} strokeWidth={1.5} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="p-3 border-t border-border/60">
          <p className="text-caption text-mid-gray truncate px-1 mb-2">{user?.email}</p>
          <button
            type="button"
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-caption text-graphite hover:bg-bone transition-colors"
          >
            <LogOut size={16} strokeWidth={1.5} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-card-bg px-4 py-3">
          <span className="text-caption text-mid-gray">Empresa</span>
          <div className="w-56">
            <SelectInput
              value={selectedCompany?.id ?? ''}
              onChange={(id) => {
                const c = companies.find((x) => x.id === id)
                if (c) selectCompany(c)
              }}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Seleccionar empresa…"
            />
          </div>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
