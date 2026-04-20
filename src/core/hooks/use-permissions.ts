import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './use-auth'
import { useCompany } from './use-company'
import { fetchMember, seedMembershipIfNeeded, fetchRoles } from '@/core/services/permissions-service'
import { cacheGet, cacheSet } from '@/core/utils/cache'
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

interface CachedPermissions {
  member: CompanyMember | null
  roles: RoleDefinition[]
}

function permissionsCacheKey(companyId: string, userId: string): string {
  return `permissions:${companyId}:${userId}`
}

export function usePermissionsLoader(): PermissionsContextValue {
  const { user } = useAuth()
  const { selectedCompany } = useCompany()

  const initialCache =
    user && selectedCompany
      ? cacheGet<CachedPermissions>(permissionsCacheKey(selectedCompany.id, user.uid))
      : null

  const [member, setMember] = useState<CompanyMember | null>(initialCache?.member ?? null)
  const [roles, setRoles] = useState<RoleDefinition[]>(initialCache?.roles ?? [])
  const [loading, setLoading] = useState(!initialCache)
  const hasHydratedRef = useRef<boolean>(Boolean(initialCache))

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

    const cacheKey = permissionsCacheKey(selectedCompany.id, user.uid)
    const cached = cacheGet<CachedPermissions>(cacheKey)
    if (cached && !hasHydratedRef.current) {
      setMember(cached.member)
      setRoles(cached.roles)
      hasHydratedRef.current = true
    }

    // Solo mostrar skeleton si no hay cache (cold load absoluto).
    if (!cached) setLoading(true)

    try {
      const [memberResult, rolesResult] = await Promise.all([
        fetchMember(selectedCompany.id, user.uid),
        fetchRoles(selectedCompany.id),
      ])

      let finalMember = memberResult
      if (!finalMember) {
        finalMember = await seedMembershipIfNeeded(
          selectedCompany.id,
          user.uid,
          user.email ?? '',
          user.displayName ?? '',
        )
      }

      setMember(finalMember)
      setRoles(rolesResult)
      cacheSet(cacheKey, { member: finalMember, roles: rolesResult } satisfies CachedPermissions)
      hasHydratedRef.current = true
    } catch (err) {
      console.error('Error loading membership:', err)
      if (!cached) setMember(null)
    } finally {
      setLoading(false)
    }
  }, [user, selectedCompany])

  useEffect(() => {
    loadMembership()
  }, [loadMembership])

  const role = member ? roles.find((r) => r.id === member.role) ?? null : null

  const can = useCallback(
    (module: ModuleKey, action: PermissionAction = 'read') => {
      if (!role) return false
      if (role.id === 'owner' || role.id === 'admin') return true
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
