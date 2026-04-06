import { Outlet } from 'react-router-dom'
import { usePermissions } from '@/core/hooks/use-permissions'
import { NoAccessPage } from './no-access-page'
import type { ModuleKey, PermissionAction } from '@/core/types/permissions'
import { Skeleton } from './skeleton'

interface Props {
  module: ModuleKey
  action?: PermissionAction
}

export function PermissionRoute({ module, action = 'read' }: Props) {
  const { can, loading, member } = usePermissions()

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  // No membership at all — no access
  if (!member) {
    return <NoAccessPage />
  }

  if (!can(module, action)) {
    return <NoAccessPage />
  }

  return <Outlet />
}
