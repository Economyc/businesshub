import { CalendarDays, ScanFace, ClipboardList, Percent, Users, Package, PlayCircle, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  label: string
  path: string
  /** pageId del access-registry para gatear con usePermissions. Sin pageId el
   *  item lo ve cualquier miembro (p.ej. Tutoriales) y no cuenta como inicio. */
  pageId?: string
  icon: LucideIcon
}

// Navegación curada de App2 (NO se deriva del registry global para no arrastrar
// todo App1). Cada ítem se filtra por permiso vía canAccessPage(pageId).
export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Horarios', path: '/horarios', pageId: 'schedule', icon: CalendarDays },
  { label: 'Marcación', path: '/marcacion', pageId: 'schedule', icon: ScanFace },
  { label: 'Equipo', path: '/talent', pageId: 'talent', icon: Users },
  { label: 'Cierres de Caja', path: '/cierres', pageId: 'closings', icon: ClipboardList },
  { label: 'Descuentos', path: '/descuentos', pageId: 'discounts', icon: Percent },
  { label: 'Inventarios', path: '/inventario', pageId: 'inventory', icon: Package },
  { label: 'Tutoriales', path: '/tutoriales', icon: PlayCircle },
]
