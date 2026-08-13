import type { LucideIcon } from 'lucide-react'
import { getAllPages, type AccessPage } from '@/core/config/access-registry'

export interface NavItem {
  to: string
  label: string
  icon?: LucideIcon
  /** pageId del registro para el gating de visibilidad. */
  pageId?: string
  /** Para openers de panel: visible si alguna página hija es accesible. */
  childPageIds?: string[]
  end?: boolean
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

function toNavItem(p: AccessPage): NavItem {
  return {
    to: p.path,
    label: p.label,
    icon: p.icon,
    // El opener de panel se filtra por sus hijas; el resto por su propio pageId.
    pageId: p.nav?.isSubPanel ? undefined : p.id,
    childPageIds: p.nav?.childPageIds,
    end: p.nav?.end,
  }
}

const sortByOrder = (a: AccessPage, b: AccessPage) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0)

/** Secciones del sidebar derivadas de las páginas con `nav.group === 'main'`. */
export const NAV_SECTIONS: NavSection[] = (() => {
  const mainPages = getAllPages().filter((p) => p.nav?.group === 'main')
  const order: string[] = []
  const groups = new Map<string, AccessPage[]>()
  for (const p of mainPages) {
    const key = p.nav?.section ?? ''
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(p)
  }
  return order.map((key) => ({
    title: key || undefined,
    items: groups.get(key)!.slice().sort(sortByOrder).map(toNavItem),
  }))
})()

/** Sub-páginas del panel de Configuración. */
export const SETTINGS_ITEMS: { to: string; label: string; icon: LucideIcon; pageId: string }[] =
  getAllPages()
    .filter((p) => p.nav?.group === 'settings')
    .slice()
    .sort(sortByOrder)
    .map((p) => ({ to: p.path, label: p.label, icon: p.icon as LucideIcon, pageId: p.id }))

/** Visibilidad de un item de nav según el acceso del usuario. */
export function isNavItemVisible(item: NavItem, canAccessPage: (pageId: string) => boolean): boolean {
  if (item.childPageIds && item.childPageIds.length > 0) {
    return item.childPageIds.some(canAccessPage)
  }
  if (item.pageId) return canAccessPage(item.pageId)
  return true
}

export function getActiveSections(pathname: string): Set<string> {
  const active = new Set<string>()
  for (const section of NAV_SECTIONS) {
    if (section.title && section.items.some((item) => pathname.startsWith(item.to))) {
      active.add(section.title)
    }
  }
  return active
}
