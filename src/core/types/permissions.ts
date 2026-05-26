import type { Timestamp } from 'firebase/firestore'

export type ModuleKey =
  | 'home'
  | 'analytics'
  | 'agent'
  | 'tasks'
  | 'finance'
  | 'closings'
  | 'contracts'
  | 'partners'
  | 'talent'
  | 'suppliers'
  | 'marketing'
  | 'settings'

export type PermissionAction = 'read' | 'create' | 'update' | 'delete'

/**
 * @deprecated Modelo viejo de permisos por módulo. Se conserva solo para migrar
 * roles guardados en Firestore con esta forma a `RolePermissions`.
 * Ver `migrateLegacyPermissions` en `@/core/config/access-registry`.
 */
export interface ModulePermission {
  module: ModuleKey
  actions: PermissionAction[]
}

/**
 * Permisos de un rol. Granularidad página + tab:
 * - `pages`: por cada pageId del registro, las acciones CRUD concedidas.
 *   Ausencia o `[]` = sin acceso a la página.
 * - `tabs`: por cada tabId del registro, visibilidad on/off.
 *   Ausencia o `false` = tab oculto.
 *
 * El owner (madre) ignora este mapa: tiene acceso total por bypass.
 * Nodos nuevos del registro quedan OFF por defecto (no aparecen en el mapa).
 */
export interface RolePermissions {
  pages: Record<string, PermissionAction[]>
  tabs: Record<string, boolean>
}

export interface RoleDefinition {
  id: string
  label: string
  description: string
  color: string
  isSystem: boolean
  permissions: RolePermissions
  canManageUsers: boolean
  canManageCompany: boolean
  /**
   * Companies a las que el usuario con este rol puede entrar.
   * - `undefined` o `[]` = sin restricción (todas las companies de las que sea miembro).
   * - Array no vacío = exclusivamente esas companies.
   * El owner ignora este filtro (acceso total por bypass).
   */
  allowedCompanyIds?: string[]
}

export interface CompanyMember {
  id: string
  userId: string
  email: string
  displayName: string
  role: string
  status: 'active' | 'invited' | 'suspended'
  invitedBy?: string
  invitedAt?: Timestamp
  joinedAt?: Timestamp
}
