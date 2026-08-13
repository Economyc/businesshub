import type { LucideIcon } from 'lucide-react'
import {
  Users,
  Briefcase,
  Tags,
  Network,
  ClipboardList,
  Shield,
  RefreshCw,
  Building2,
  Percent,
  KeyRound,
  CalendarDays,
  CreditCard,
  Package,
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
      { id: 'analytics', label: 'Análisis', path: '/analytics', actions: ['read'], nav: { group: 'main', order: 2 } },
    ],
  },
  {
    id: 'finance',
    label: 'Finanzas',
    pages: [
      // El panel de Contabilidad (Facturación, Nómina, Extracto, Flujo de Caja,
      // Estado de Resultados, Análisis y Presupuesto) se retiró de BusinessHub:
      // esa operación vive en Ecore (ecore.economyc.cc).
      //
      // Cierres y Descuentos quedan SIN `nav` — igual que Horarios e Inventarios
      // más abajo: no salen en el sidebar de App1, pero conservan su pageId para
      // que App2 (businessadm) los siga montando con PermissionRoute.
      {
        id: 'closings',
        label: 'Cierres de Caja',
        path: '/closings',
        icon: ClipboardList,
        actions: [...ALL_ACTIONS],
        tabs: [
          { id: 'closings.form', label: 'Nuevo Cierre' },
          { id: 'closings.history', label: 'Cierres' },
          { id: 'closings.accumulated', label: 'Acumulado' },
        ],
      },
      { id: 'discounts', label: 'Descuentos', path: '/discounts', icon: Percent, actions: [...ALL_ACTIONS] },
    ],
  },
  {
    id: 'operations',
    label: 'Operaciones',
    pages: [
      // Contratos y Socios se retiraron de BusinessHub (Socios vive en Ecore).
      //
      // Equipo y Proveedores quedan SIN `nav`: no salen en el sidebar de App1,
      // pero App2 monta /talent y su módulo de Inventarios usa `useSuppliers`,
      // así que ambos pageId siguen haciendo falta para el gating de permisos.
      {
        id: 'talent',
        label: 'Equipo',
        path: '/talent',
        icon: Users,
        actions: [...ALL_ACTIONS],
        tabs: [
          { id: 'talent.profile.info', label: 'Información' },
          { id: 'talent.profile.documentos', label: 'Documentos' },
        ],
      },
      { id: 'suppliers', label: 'Proveedores', path: '/suppliers', icon: Briefcase, actions: [...ALL_ACTIONS] },
      // Horarios vive solo en App2 (herramienta operativa de local). Sin `nav`
      // para NO aparecer en el sidebar de App1, pero sí en la matriz de Roles
      // para poder concederlo a los puestos que arman horarios.
      { id: 'schedule', label: 'Horarios', path: '/horarios', icon: CalendarDays, actions: [...ALL_ACTIONS] },
      // Inventarios vive solo en App2 (herramienta operativa de local). Igual que
      // Horarios: sin `nav` (no aparece en sidebar de App1) pero sí en la matriz
      // de Roles. El sidebar de App2 lo monta vía `ADMIN_NAV` (src/admin/nav.ts).
      {
        id: 'inventory',
        label: 'Inventarios',
        path: '/inventario',
        icon: Package,
        actions: [...ALL_ACTIONS],
        tabs: [
          { id: 'inventory.stock', label: 'Stock' },
          { id: 'inventory.recipes', label: 'Recetas' },
          { id: 'inventory.ingredients', label: 'Insumos' },
          { id: 'inventory.count', label: 'Conteo' },
          { id: 'inventory.entries', label: 'Entradas' },
          { id: 'inventory.waste', label: 'Mermas' },
        ],
      },
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
      { id: 'settings.departments', label: 'Departamentos', path: '/settings/departments', icon: Network, actions: [...ALL_ACTIONS], nav: { group: 'settings', order: 5 } },
      { id: 'settings.payment-methods', label: 'Métodos de pago', path: '/settings/payment-methods', icon: CreditCard, actions: [...ALL_ACTIONS], nav: { group: 'settings', order: 6 } },
    ],
  },
]

/** Ids de tabs estables — importar desde aquí en los componentes (nunca string suelto). */
export const TAB_IDS = {
  closingsForm: 'closings.form',
  closingsHistory: 'closings.history',
  closingsAccumulated: 'closings.accumulated',
  talentInfo: 'talent.profile.info',
  talentDocumentos: 'talent.profile.documentos',
  posVentas: 'pos-sync.ventas',
  posCatalogo: 'pos-sync.catalogo',
  posAnuladas: 'pos-sync.anuladas',
  posCache: 'pos-sync.cache',
  inventoryStock: 'inventory.stock',
  inventoryRecipes: 'inventory.recipes',
  inventoryIngredients: 'inventory.ingredients',
  inventoryCount: 'inventory.count',
  inventoryEntries: 'inventory.entries',
  inventoryWaste: 'inventory.waste',
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
  analytics: 'analytics',
  closings: 'closings',
  discounts: 'closings',
  talent: 'talent',
  suppliers: 'suppliers',
  'settings.team': 'settings',
  'settings.companies': 'settings',
  'settings.categories': 'settings',
  'settings.roles': 'settings',
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
