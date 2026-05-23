import { Outlet } from 'react-router-dom'
import { AdminSidebar } from './sidebar'

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-bone">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
