import type { RoleDefinition, ModuleKey, PermissionAction } from '@/core/types/permissions'

const ALL_MODULES: ModuleKey[] = [
  'home', 'analytics', 'agent', 'finance', 'cartera', 'closings',
  'payroll', 'prestaciones', 'contracts', 'partners', 'talent', 'suppliers', 'marketing', 'settings',
]

const ALL_ACTIONS: PermissionAction[] = ['read', 'create', 'update', 'delete']

function fullAccess(modules: ModuleKey[]) {
  return modules.map((module) => ({ module, actions: [...ALL_ACTIONS] }))
}

function readOnly(modules: ModuleKey[]) {
  return modules.map((module) => ({ module, actions: ['read'] as PermissionAction[] }))
}

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    label: 'Propietario',
    description: 'Acceso total a todos los modulos, gestion de usuarios y configuracion de empresa',
    color: '#1a1a2e',
    isSystem: true,
    permissions: fullAccess(ALL_MODULES),
    canManageUsers: true,
    canManageCompany: true,
  },
  {
    id: 'admin',
    label: 'Administrador',
    description: 'Acceso completo a todos los modulos y gestion de usuarios',
    color: '#7c3aed',
    isSystem: true,
    permissions: fullAccess(ALL_MODULES),
    canManageUsers: true,
    canManageCompany: true,
  },
  {
    id: 'finance',
    label: 'Finanzas',
    description: 'Gestion financiera: transacciones, compras, cierres, cartera y proveedores',
    color: '#0891b2',
    isSystem: true,
    permissions: [
      ...fullAccess(['finance', 'cartera', 'closings', 'suppliers']),
      ...readOnly(['home', 'analytics', 'partners']),
    ],
    canManageUsers: false,
    canManageCompany: false,
  },
  {
    id: 'hr',
    label: 'Recursos Humanos',
    description: 'Gestion de personal: equipo, nomina, prestaciones y contratos',
    color: '#059669',
    isSystem: true,
    permissions: [
      ...fullAccess(['talent', 'payroll', 'prestaciones', 'contracts']),
      ...readOnly(['home', 'analytics']),
    ],
    canManageUsers: false,
    canManageCompany: false,
  },
  {
    id: 'viewer',
    label: 'Solo lectura',
    description: 'Puede ver informacion pero no crear, editar ni eliminar',
    color: '#6b7280',
    isSystem: true,
    permissions: readOnly(ALL_MODULES.filter((m) => m !== 'settings')),
    canManageUsers: false,
    canManageCompany: false,
  },
]

export function getRoleById(roleId: string): RoleDefinition | undefined {
  return DEFAULT_ROLES.find((r) => r.id === roleId)
}
