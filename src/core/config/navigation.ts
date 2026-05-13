import { Home, Users, Briefcase, DollarSign, Tags, BadgeCheck, Network, Handshake, ClipboardList, FileSignature, Wallet, FileText, Shield, RefreshCw, Megaphone, List, Target, Building2, Percent } from 'lucide-react'
import type { ModuleKey } from '@/core/types/permissions'

export interface NavItem {
  to: string
  label: string
  icon?: typeof Home
  moduleKey?: ModuleKey
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/home', label: 'Home', moduleKey: 'home' },
      { to: '/tasks', label: 'Tasks', moduleKey: 'tasks' },
      { to: '/agent', label: 'Asistente AI', moduleKey: 'agent' },
      { to: '/analytics', label: 'Análisis', moduleKey: 'analytics' },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { to: '/finance', label: 'Contabilidad', icon: DollarSign, moduleKey: 'finance' },
      { to: '/closings', label: 'Cierres de Caja', icon: ClipboardList, moduleKey: 'closings' },
      { to: '/discounts', label: 'Descuentos', icon: Percent, moduleKey: 'closings' },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/contracts', label: 'Contratos', icon: FileSignature, moduleKey: 'contracts' },
      { to: '/partners', label: 'Socios', icon: Handshake, moduleKey: 'partners' },
      { to: '/talent', label: 'Equipo', icon: Users, moduleKey: 'talent' },
      { to: '/suppliers', label: 'Proveedores', icon: Briefcase, moduleKey: 'suppliers' },
    ],
  },
  {
    title: 'Mercadeo',
    items: [
      { to: '/marketing/influencers', label: 'Influencers', icon: Megaphone, moduleKey: 'marketing' },
    ],
  },
  {
    title: 'Integraciones',
    items: [
      { to: '/pos-sync', label: 'POS Sync', icon: RefreshCw },
    ],
  },
]

export const SETTINGS_ITEMS = [
  { to: '/settings/team', label: 'Equipo', icon: Shield },
  { to: '/settings/companies', label: 'Compañías', icon: Building2 },
  { to: '/settings/categories', label: 'Categorías', icon: Tags },
  { to: '/settings/roles', label: 'Cargos', icon: BadgeCheck },
  { to: '/settings/departments', label: 'Departamentos', icon: Network },
]

export const FINANCE_ITEMS: (Omit<NavItem, 'icon'> & { icon: typeof Home; end?: boolean })[] = [
  { to: '/finance', label: 'Facturación', icon: List, end: true },
  { to: '/finance/cash-flow', label: 'Flujo de Caja', icon: Wallet },
  { to: '/finance/income-statement', label: 'Estado de Resultados', icon: FileText },
  { to: '/finance/budget', label: 'Presupuesto', icon: Target },
]

export function getActiveSections(pathname: string): Set<string> {
  const active = new Set<string>()
  for (const section of NAV_SECTIONS) {
    if (section.title && section.items.some(item => pathname.startsWith(item.to))) {
      active.add(section.title)
    }
  }
  return active
}
