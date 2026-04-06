import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './use-auth'
import { useCompany } from './use-company'
import { fetchMember, seedMembershipIfNeeded } from '@/core/services/permissions-service'
import { DEFAULT_ROLES, getRoleById } from '@/core/config/default-roles'
import type { CompanyMember, ModuleKey, PermissionAction, RoleDefinition } from '@/core/types/permissions'

export interface PermissionsContextValue {
  member: CompanyMember | null
  role: RoleDefinition | null
  loading: boolean
  can: (module: ModuleKey, action?: PermissionAction) => boolean
  isOwner: boolean
  isAdmin: boolean
  canManageUsers: boolean
  refetch: () => Promise<void>
}

export const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function usePermissionsLoader(): PermissionsContextValue {
  const { user } = useAuth()
  const { selectedCompany } = useCompany()
  const [member, setMember] = useState<CompanyMember | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMembership = useCallback(async () => {
    if (!user || !selectedCompany) {
      setMember(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Try to fetch existing membership, or seed if admin@filipoblue.co
      let m = await fetchMember(selectedCompany.id, user.uid)
      if (!m) {
        m = await seedMembershipIfNeeded(
          selectedCompany.id,
          user.uid,
          user.email ?? '',
          user.displayName ?? '',
        )
      }
      setMember(m)
    } catch (err) {
      console.error('Error loading membership:', err)
      setMember(null)
    } finally {
      setLoading(false)
    }
  }, [user, selectedCompany])

  useEffect(() => {
    loadMembership()
  }, [loadMembership])

  const role = member ? getRoleById(member.role) ?? null : null

  const can = useCallback(
    (module: ModuleKey, action: PermissionAction = 'read') => {
      if (!role) return false
      const perm = role.permissions.find((p) => p.module === module)
      if (!perm) return false
      return perm.actions.includes(action)
    },
    [role],
  )

  return {
    member,
    role,
    loading,
    can,
    isOwner: member?.role === 'owner',
    isAdmin: member?.role === 'owner' || member?.role === 'admin',
    canManageUsers: role?.canManageUsers ?? false,
    refetch: loadMembership,
  }
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider')
  return ctx
}
