import { Outlet } from 'react-router-dom'
import { usePermissions } from '@/core/hooks/use-permissions'
import { NoAccessPage } from './no-access-page'
import type { PermissionAction } from '@/core/types/permissions'
import { Skeleton } from './skeleton'

interface Props {
  pageId: string
  action?: PermissionAction
}

export function PermissionRoute({ pageId, action }: Props) {
  const { can, canAccessPage, loading, member } = usePermissions()

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
    return <NoAccessPage requestedPageId={pageId} />
  }

  const allowed = action ? can(pageId, action) : canAccessPage(pageId)
  if (!allowed) {
    return <NoAccessPage requestedPageId={pageId} />
  }

  return <Outlet />
}
