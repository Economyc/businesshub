import type { LucideIcon } from 'lucide-react'
import {
  Users,
  Briefcase,
  DollarSign,
  Tags,
  BadgeCheck,
  Network,
  Handshake,
  ClipboardList,
  FileSignature,
  Wallet,
  FileText,
  Shield,
  RefreshCw,
  Megaphone,
  List,
  Target,
  Building2,
  Percent,
  Landmark,
  KeyRound,
} from 'lucide-react'
import type {
  ModuleKey,
  ModulePermission,
  PermissionAction,
  RolePermissions,
} from '@/core/types/permissions'

/**
 * REGISTRO CENTRAL DE ACCESO — fuente única de verdad de páginas, módulos y tabs.
 *
 * De aquí derivan: (a) la navegación del sidebar (`navigation.ts`), (b) la matriz
 * de la página de Roles, y (c) el enforcement (`use-permissions`, `PermissionRoute`,
 * filtrado de tabs).
 *
 * Para agregar una página/tab nueva: añadirla aquí. Aparecerá automáticamente en
 * la matriz de Roles (y en el sidebar si tiene `nav`). Queda OFF por defecto para
 * los roles existentes; solo el owner la obtiene de inmediato (bypass).
 */

/** Email del usuario madre con acceso total (bypass de permisos). */
export const OWNER_EMAIL = 'admin@filipoblue.co'

const ALL_ACTIONS: PermissionAction[] = ['read', 'create', 'update', 'delete']

export type NavGroup = 'main' | 'finance' | 'settings'

export interface AccessTab {
  id: string
  label: string
}

export interface AccessNav {
  group: NavGroup
  /** Título de sección del sidebar (solo `group: 'main'`). */
  section?: string
  order: number
  /** NavLink exacto (match end). */
  end?: boolean
  /** Abre un sub-panel deslizable en vez de navegar (caso Finanzas). */
  isSubPanel?: boolean
  /** Para openers de panel: ids de páginas hijas que determinan su visibilidad. */
  childPageIds?: string[]
}

export interface AccessPage {
  id: string
  label: string
  path: string
  icon?: LucideIcon
  /** Acciones CRUD disponibles para esta página (lo que se puede togglear). */
  actions: PermissionAction[]
  tabs?: AccessTab[]
  nav?: AccessNav
  /** No mostrar como fila editable en la matriz de Roles (ej. opener de panel). */
  matrixHidden?: boolean
}

export interface AccessModule {
  id: string
  label: string
  pages: AccessPage[]
}

export const ACCESS_REGISTRY: AccessModule[] = [
  {
    id: 'general',
    label: 'General',
    pages: [
      { id: 'home', label: 'Home', path: '/home', actions: ['read'], nav: { group: 'main', order: 1 } },
      { id: 'tasks', label: 'Tasks', path: '/tasks', actions: [...ALL_ACTIONS], nav: { group: 'main', order: 2 } },
      { id: 'agent', label: 'Asistente AI', path: '/agent', actions: ['read'], nav: { group: 'main', order: 3 } },
      { id: 'analytics', label: 'Análisis', path: '/analytics', actions: ['read'], nav: { group: 'main', order: 4 } },
    ],
  },
  {
    id: 'finance',
    label: 'Finanzas',
    pages: [
      // Opener del panel de Contabilidad. No es fila de matriz: agrupa las páginas
      // de finanzas y se muestra si el rol accede a alguna de ellas.
      {
        id: 'finance',
        label: 'Contabilidad',
        path: '/finance',
        icon: DollarSign,
        actions: [],
        matrixHidden: true,
        nav: {
          group: 'main',
          section: 'Finanzas',
          order: 1,
          isSubPanel: true,
          childPageIds: [
            'finance.invoicing',
            'finance.payroll',
            'finance.bank',
            'finance.cashflow',
            'finance.income',
            'finance.budget',
          ],
        },
      },
      { id: 'finance.invoicing', label: 'Facturación', path: '/finance', icon: List, actions: [...ALL_ACTIONS], nav: { group: 'finance', order: 1, end: true } },
      {
        id: 'finance.payroll',
        label: 'Nómina',
        path: '/finance/nomina',
        icon: Users,
        actions: [...ALL_ACTIONS],
        nav: { group: 'finance', order: 2 },
        tabs: [
          { id: 'finance.payroll.nomina', label: 'Nómina' },
          { id: 'finance.payroll.propinas', label: 'Propinas' },
          { id: 'finance.payroll.historial', label: 'Historial' },
        ],
      },
      { id: 'finance.bank', label: 'Extracto Bancario', path: '/finance/bank', icon: Landmark, actions: [...ALL_ACTIONS], nav: { group: 'finance', order: 3 } },
      { id: 'finance.cashflow', label: 'Flujo de Caja', path: '/finance/cash-flow', icon: Wallet, actions: ['read'], nav: { group: 'finance', order: 4 } },
      { id: 'finance.income', label: 'Estado de Resultados', path: '/finance/income-statement', icon: FileText, actions: ['read'], nav: { group: 'finance', order: 5 } },
      { id: 'finance.budget', label: 'Presupuesto', path: '/finance/budget', icon: Target, actions: [...ALL_ACTIONS], nav: { group: 'finance', order: 6 } },
      {
        id: 'closings',
        label: 'Cierres de Caja',
        path: '/closings',
        icon: ClipboardList,
        actions: [...ALL_ACTIONS],
        nav: { group: 'main', section: 'Finanzas', order: 2 },
        tabs: [
          { id: 'closings.form', label: 'Nuevo Cierre' },
          { id: 'closings.history', label: 'Cierres' },
          { id: 'closings.accumulated', label: 'Acumulado' },
        ],
      },
      { id: 'discounts', label: 'Descuentos', path: '/discounts', icon: Percent, actions: [...ALL_ACTIONS], nav: { group: 'main', section: 'Finanzas', order: 3 } },
    ],
  },
  {
    id: 'operations',
    label: 'Operaciones',
    pages: [
      {
        id: 'contracts',
        label: 'Contratos',
        path: '/contracts',
        icon: FileSignature,
        actions: [...ALL_ACTIONS],
        nav: { group: 'main', section: 'Operaciones', order: 1 },
        tabs: [
          { id: 'contracts.list', label: 'Contratos' },
          { id: 'contracts.templates', label: 'Plantillas' },
        ],
      },
      { id: 'partners', label: 'Socios', path: '/partners', icon: Handshake, actions: [...ALL_ACTIONS], nav: { group: 'main', section: 'Operaciones', order: 2 } },
      {
        id: 'talent',
        label: 'Equipo',
        path: '/talent',
        icon: Users,
        actions: [...ALL_ACTIONS],
        nav: { group: 'main', section: 'Operaciones', order: 3 },
        tabs: [
          { id: 'talent.profile.info', label: 'Información' },
          { id: 'talent.profile.documentos', label: 'Documentos' },
        ],
      },
      { id: 'suppliers', label: 'Proveedores', path: '/suppliers', icon: Briefcase, actions: [...ALL_ACTIONS], nav: { group: 'main', section: 'Operaciones', order: 4 } },
    ],
  },
  {
    id: 'marketing',
    label: 'Mercadeo',
    pages: [
      { id: 'marketing', label: 'Influencers', path: '/marketing/influencers', icon: Megaphone, actions: [...ALL_ACTIONS], nav: { group: 'main', section: 'Mercadeo', order: 1 } },
    ],
  },
  {
    id: 'integrations',
    label: 'Integraciones',
    pages: [
      {
        id: 'pos-sync',
        label: 'POS Sync',
        path: '/pos-sync',
        icon: RefreshCw,
        actions: ['read'],
        nav: { group: 'main', section: 'Integraciones', order: 1 },
        tabs: [
          { id: 'pos-sync.ventas', label: 'Ventas' },
          { id: 'pos-sync.catalogo', label: 'Catálogo' },
          { id: 'pos-sync.anuladas', label: 'Anuladas' },
          { id: 'pos-sync.cache', label: 'Caché' },
        ],
      },
    ],
  },
  {
    id: 'system',
    label: 'Configuración',
    pages: [
      { id: 'settings.team', label: 'Equipo', path: '/settings/team', icon: Shield, actions: [...ALL_ACTIONS], nav: { group: 'settings', order: 1 } },
      { id: 'settings.companies', label: 'Compañías', path: '/settings/companies', icon: Building2, actions: [...ALL_ACTIONS], nav: { group: 'settings', order: 2 } },
      { id: 'settings.categories', label: 'Categorías', path: '/settings/categories', icon: Tags, actions: [...ALL_ACTIONS], nav: { group: 'settings', order: 3 } },
      { id: 'settings.roles', label: 'Roles', path: '/settings/roles', icon: KeyRound, actions: [...ALL_ACTIONS], nav: { group: 'settings', order: 4 } },
      { id: 'settings.puestos', label: 'Puestos', path: '/settings/puestos', icon: BadgeCheck, actions: [...ALL_ACTIONS], nav: { group: 'settings', order: 5 } },
      { id: 'settings.departments', label: 'Departamentos', path: '/settings/departments', icon: Network, actions: [...ALL_ACTIONS], nav: { group: 'settings', order: 6 } },
    ],
  },
]

/** Ids de tabs estables — importar desde aquí en los componentes (nunca string suelto). */
export const TAB_IDS = {
  payrollNomina: 'finance.payroll.nomina',
  payrollPropinas: 'finance.payroll.propinas',
  payrollHistorial: 'finance.payroll.historial',
  closingsForm: 'closings.form',
  closingsHistory: 'closings.history',
  closingsAccumulated: 'closings.accumulated',
  contractsList: 'contracts.list',
  contractsTemplates: 'contracts.templates',
  talentInfo: 'talent.profile.info',
  talentDocumentos: 'talent.profile.documentos',
  posVentas: 'pos-sync.ventas',
  posCatalogo: 'pos-sync.catalogo',
  posAnuladas: 'pos-sync.anuladas',
  posCache: 'pos-sync.cache',
} as const

// ---- Helpers ----

export function getAllPages(): AccessPage[] {
  return ACCESS_REGISTRY.flatMap((m) => m.pages)
}

/** Páginas mostrables como filas editables en la matriz (excluye openers de panel). */
export function getMatrixPages(): AccessPage[] {
  return getAllPages().filter((p) => !p.matrixHidden)
}

export function getPageById(id: string): AccessPage | undefined {
  return getAllPages().find((p) => p.id === id)
}

/** Resuelve la página por su path (prefiere la página real sobre el opener). */
export function getPageByPath(path: string): AccessPage | undefined {
  const matches = getAllPages().filter((p) => p.path === path)
  return matches.find((p) => !p.matrixHidden) ?? matches[0]
}

export function getAllTabIds(): string[] {
  return getAllPages().flatMap((p) => p.tabs?.map((t) => t.id) ?? [])
}

export function defaultPermissionsOff(): RolePermissions {
  return { pages: {}, tabs: {} }
}

export function defaultPermissionsFull(): RolePermissions {
  const pages: Record<string, PermissionAction[]> = {}
  const tabs: Record<string, boolean> = {}
  for (const p of getMatrixPages()) pages[p.id] = [...p.actions]
  for (const id of getAllTabIds()) tabs[id] = true
  return { pages, tabs }
}

/** Mapea cada pageId del registro a su ModuleKey legado, para migrar roles viejos. */
const PAGE_LEGACY_MODULE: Record<string, ModuleKey> = {
  home: 'home',
  tasks: 'tasks',
  agent: 'agent',
  analytics: 'analytics',
  'finance.invoicing': 'finance',
  'finance.payroll': 'finance',
  'finance.bank': 'finance',
  'finance.cashflow': 'finance',
  'finance.income': 'finance',
  'finance.budget': 'finance',
  closings: 'closings',
  discounts: 'closings',
  contracts: 'contracts',
  partners: 'partners',
  talent: 'talent',
  suppliers: 'suppliers',
  marketing: 'marketing',
  'settings.team': 'settings',
  'settings.companies': 'settings',
  'settings.categories': 'settings',
  'settings.roles': 'settings',
  'settings.puestos': 'settings',
  'settings.departments': 'settings',
}

/**
 * Migra permisos en forma vieja (`ModulePermission[]`) al nuevo `RolePermissions`.
 * Cada módulo viejo se expande a las páginas del registro que le corresponden,
 * intersectando con las acciones disponibles de cada página. Habilita los tabs de
 * las páginas accesibles (best effort).
 */
export function migrateLegacyPermissions(old: ModulePermission[]): RolePermissions {
  const byModule = new Map<ModuleKey, PermissionAction[]>()
  for (const mp of old) byModule.set(mp.module, mp.actions)

  const pages: Record<string, PermissionAction[]> = {}
  const tabs: Record<string, boolean> = {}

  for (const p of getMatrixPages()) {
    const legacyModule = PAGE_LEGACY_MODULE[p.id]
    if (!legacyModule) continue
    const granted = byModule.get(legacyModule)
    if (!granted || granted.length === 0) continue
    const actions = p.actions.filter((a) => granted.includes(a))
    if (actions.length === 0) continue
    pages[p.id] = actions
    if (p.tabs) for (const t of p.tabs) tabs[t.id] = true
  }

  return { pages, tabs }
}
