import type { Timestamp } from 'firebase/firestore'

export type ModuleKey =
  | 'home'
  | 'analytics'
  | 'agent'
  | 'finance'
  | 'cartera'
  | 'closings'
  | 'payroll'
  | 'prestaciones'
  | 'contracts'
  | 'partners'
  | 'talent'
  | 'suppliers'
  | 'marketing'
  | 'settings'

export type PermissionAction = 'read' | 'create' | 'update' | 'delete'

export interface ModulePermission {
  module: ModuleKey
  actions: PermissionAction[]
}

export interface RoleDefinition {
  id: string
  label: string
  description: string
  color: string
  isSystem: boolean
  permissions: ModulePermission[]
  canManageUsers: boolean
  canManageCompany: boolean
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

/** Maps route paths to their module key for permission checks */
export const ROUTE_MODULE_MAP: Record<string, ModuleKey> = {
  '/home': 'home',
  '/analytics': 'analytics',
  '/agent': 'agent',
  '/finance': 'finance',
  '/cartera': 'cartera',
  '/closings': 'closings',
  '/payroll': 'payroll',
  '/prestaciones': 'prestaciones',
  '/contracts': 'contracts',
  '/partners': 'partners',
  '/talent': 'talent',
  '/suppliers': 'suppliers',
  '/marketing/influencers': 'marketing',
  '/settings': 'settings',
}
