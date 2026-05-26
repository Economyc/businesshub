import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './use-auth'
import { useCompany } from './use-company'
import { fetchMember, seedMembershipIfNeeded, fetchRoles } from '@/core/services/permissions-service'
import { cacheGet, cacheSet } from '@/core/utils/cache'
import { OWNER_EMAIL } from '@/core/config/access-registry'
import type { CompanyMember, PermissionAction, RoleDefinition } from '@/core/types/permissions'

export interface PermissionsContextValue {
  member: CompanyMember | null
  role: RoleDefinition | null
  roles: RoleDefinition[]
  loading: boolean
  /** ¿El rol puede ejecutar `action` sobre la página `pageId`? */
  can: (pageId: string, action?: PermissionAction) => boolean
  /** ¿El rol tiene cualquier acceso a la página `pageId`? */
  canAccessPage: (pageId: string) => boolean
  /** ¿El rol puede ver el tab `tabId`? */
  canAccessTab: (tabId: string) => boolean
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

// v2: el modelo de `roles[].permissions` cambió de ModulePermission[] a RolePermissions.
function permissionsCacheKey(companyId: string, userId: string): string {
  return `permissions:v2:${companyId}:${userId}`
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

  // Diagnóstico (solo dev): si hay member pero el rol referenciado no está en la
  // lista cargada, el usuario verá NoAccessPage sin pista visible. Aviso aquí.
  if (import.meta.env.DEV && member && !role && roles.length > 0) {
    console.warn(
      `[permissions] member.role="${member.role}" no encontrado en roles cargados`,
      { memberId: member.id, availableRoleIds: roles.map((r) => r.id) },
    )
  }

  // Owner madre: acceso total por bypass (incluye páginas/tabs nuevas).
  const isOwner = member?.role === 'owner' || (user?.email ?? '').toLowerCase() === OWNER_EMAIL
  const isAdmin = isOwner || member?.role === 'admin'

  const canAccessPage = useCallback(
    (pageId: string) => {
      if (isOwner) return true
      const acts = role?.permissions?.pages?.[pageId]
      return Array.isArray(acts) && acts.length > 0
    },
    [isOwner, role],
  )

  const can = useCallback<PermissionsContextValue['can']>(
    (pageId, action = 'read') => {
      if (isOwner) return true
      const acts = role?.permissions?.pages?.[pageId]
      return Array.isArray(acts) && acts.includes(action)
    },
    [isOwner, role],
  )

  const canAccessTab = useCallback(
    (tabId: string) => {
      if (isOwner) return true
      return role?.permissions?.tabs?.[tabId] === true
    },
    [isOwner, role],
  )

  return {
    member,
    role,
    roles,
    loading,
    can,
    canAccessPage,
    canAccessTab,
    isOwner,
    isAdmin,
    canManageUsers: isOwner || (role?.canManageUsers ?? false),
    refetch: loadMembership,
    refetchRoles: loadRoles,
  }
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider')
  return ctx
}
