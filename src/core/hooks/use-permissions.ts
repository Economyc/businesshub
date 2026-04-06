import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './use-auth'
import { useCompany } from './use-company'
import { fetchMember, seedMembershipIfNeeded, fetchRoles } from '@/core/services/permissions-service'
import type { CompanyMember, ModuleKey, PermissionAction, RoleDefinition } from '@/core/types/permissions'

export interface PermissionsContextValue {
  member: CompanyMember | null
  role: RoleDefinition | null
  roles: RoleDefinition[]
  loading: boolean
  can: (module: ModuleKey, action?: PermissionAction) => boolean
  isOwner: boolean
  isAdmin: boolean
  canManageUsers: boolean
  refetch: () => Promise<void>
  refetchRoles: () => Promise<void>
}

export const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function usePermissionsLoader(): PermissionsContextValue {
  const { user } = useAuth()
  const { selectedCompany } = useCompany()
  const [member, setMember] = useState<CompanyMember | null>(null)
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [loading, setLoading] = useState(true)

  const loadRoles = useCallback(async () => {
    if (!selectedCompany) return
    try {
      const r = await fetchRoles(selectedCompany.id)
      setRoles(r)
    } catch (err) {
      console.error('Error loading roles:', err)
    }
  }, [selectedCompany])

  const loadMembership = useCallback(async () => {
    if (!user || !selectedCompany) {
      setMember(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
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
      await loadRoles()
    } catch (err) {
      console.error('Error loading membership:', err)
      setMember(null)
    } finally {
      setLoading(false)
    }
  }, [user, selectedCompany, loadRoles])

  useEffect(() => {
    loadMembership()
  }, [loadMembership])

  const role = member ? roles.find((r) => r.id === member.role) ?? null : null

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
    roles,
    loading,
    can,
    isOwner: member?.role === 'owner',
    isAdmin: member?.role === 'owner' || member?.role === 'admin',
    canManageUsers: role?.canManageUsers ?? false,
    refetch: loadMembership,
    refetchRoles: loadRoles,
  }
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider')
  return ctx
}
