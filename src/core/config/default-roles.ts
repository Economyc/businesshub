import type { RoleDefinition, PermissionAction, RolePermissions } from '@/core/types/permissions'
import { getMatrixPages, defaultPermissionsFull } from '@/core/config/access-registry'

/** Permisos para un conjunto de páginas, con las acciones indicadas (acotadas a las
 *  disponibles de cada página) y todos sus tabs habilitados. */
function permsFor(pageIds: string[], actions: PermissionAction[]): RolePermissions {
  const pages: Record<string, PermissionAction[]> = {}
  const tabs: Record<string, boolean> = {}
  const wanted = new Set(pageIds)
  for (const p of getMatrixPages()) {
    if (!wanted.has(p.id)) continue
    const allowed = p.actions.filter((a) => actions.includes(a))
    if (allowed.length === 0) continue
    pages[p.id] = allowed
    if (p.tabs) for (const t of p.tabs) tabs[t.id] = true
  }
  return { pages, tabs }
}

function merge(...parts: RolePermissions[]): RolePermissions {
  const pages: Record<string, PermissionAction[]> = {}
  const tabs: Record<string, boolean> = {}
  for (const part of parts) {
    Object.assign(pages, part.pages)
    Object.assign(tabs, part.tabs)
  }
  return { pages, tabs }
}

const ALL: PermissionAction[] = ['read', 'create', 'update', 'delete']
const READ: PermissionAction[] = ['read']

const FINANCE_PAGES = [
  'finance.invoicing',
  'finance.payroll',
  'finance.bank',
  'finance.cashflow',
  'finance.income',
  'finance.analysis',
  'finance.budget',
]

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    label: 'Propietario',
    description: 'Acceso total a todos los módulos, gestión de usuarios y configuración de empresa',
    color: '#1a1a2e',
    isSystem: true,
    permissions: defaultPermissionsFull(),
    canManageUsers: true,
    canManageCompany: true,
  },
  {
    id: 'admin',
    label: 'Administrador',
    description: 'Acceso completo a todos los módulos y gestión de usuarios',
    color: '#7c3aed',
    isSystem: true,
    permissions: defaultPermissionsFull(),
    canManageUsers: true,
    canManageCompany: true,
  },
  {
    id: 'finance',
    label: 'Finanzas',
    description: 'Gestión financiera: facturación, nómina, cierres y proveedores',
    color: '#0891b2',
    isSystem: true,
    permissions: merge(
      permsFor([...FINANCE_PAGES, 'closings', 'discounts', 'suppliers', 'tasks'], ALL),
      permsFor(['home', 'analytics', 'partners'], READ),
    ),
    canManageUsers: false,
    canManageCompany: false,
  },
  {
    id: 'hr',
    label: 'Recursos Humanos',
    description: 'Gestión de personal: equipo y contratos',
    color: '#059669',
    isSystem: true,
    permissions: merge(
      permsFor(['talent', 'contracts', 'tasks'], ALL),
      permsFor(['home', 'analytics'], READ),
    ),
    canManageUsers: false,
    canManageCompany: false,
  },
  {
    id: 'viewer',
    label: 'Solo lectura',
    description: 'Puede ver información pero no crear, editar ni eliminar',
    color: '#6b7280',
    isSystem: true,
    permissions: merge(
      permsFor(
        [
          'home',
          'analytics',
          'agent',
          ...FINANCE_PAGES,
          'closings',
          'discounts',
          'contracts',
          'partners',
          'talent',
          'suppliers',
          'marketing',
          'pos-sync',
        ],
        READ,
      ),
      permsFor(['tasks'], ALL),
    ),
    canManageUsers: false,
    canManageCompany: false,
  },
]

export function getRoleById(roleId: string): RoleDefinition | undefined {
  return DEFAULT_ROLES.find((r) => r.id === roleId)
}
