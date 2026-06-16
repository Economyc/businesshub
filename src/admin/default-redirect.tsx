import { Navigate } from 'react-router-dom'
import { usePermissions } from '@/core/hooks/use-permissions'
import { NoAccessPage } from '@/core/ui/no-access-page'
import { Skeleton } from '@/core/ui/skeleton'
import { ADMIN_NAV } from './nav'

// Redirige al usuario a la primera página de ADMIN_NAV a la que tiene acceso,
// en lugar del viejo redirect fijo a /horarios. Usa la misma lógica que filtra
// el sidebar (canAccessPage), así el "inicio" coincide con el primer ítem visible
// del menú. Si no tiene acceso a ningún módulo, muestra "Acceso restringido"
// en vez de quedar atrapado en un loop hacia /horarios.
export function DefaultRedirect() {
  const { canAccessPage, loading } = usePermissions()

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const first = ADMIN_NAV.find((item) => canAccessPage(item.pageId))
  if (first) return <Navigate to={first.path} replace />

  return <NoAccessPage />
}
