import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const LABELS: Record<string, string> = {
  home: 'Inicio',
  finance: 'Finanzas',
  purchases: 'Compras',
  products: 'Productos',
  new: 'Nueva',
  edit: 'Editar',
  recurring: 'Recurrentes',
  import: 'Importar',
  'cash-flow': 'Flujo de Caja',
  'income-statement': 'Estado de Resultados',
  budget: 'Presupuesto',
  reconciliation: 'Conciliación',
  analytics: 'Análisis',
  costs: 'Costos',
  pos: 'POS',
  payroll: 'Nómina',
  prestaciones: 'Prestaciones',
  talent: 'Equipo',
  suppliers: 'Proveedores',
  contracts: 'Contratos',
  templates: 'Plantillas',
  partners: 'Socios',
  closings: 'Cierres',
  cartera: 'Cartera',
  agent: 'Agente',
  marketing: 'Marketing',
  influencers: 'Influencers',
  'pos-sync': 'Sincronización POS',
  settings: 'Configuración',
  companies: 'Empresas',
  categories: 'Categorías',
  roles: 'Roles',
  departments: 'Departamentos',
  team: 'Equipo',
}

const ID_PATTERN = /^[a-zA-Z0-9]{10,}$|^[0-9a-f-]{36}$/

function isIdSegment(segment: string): boolean {
  return ID_PATTERN.test(segment)
}

export function Breadcrumb() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    const isId = isIdSegment(segment)
    const label = isId ? 'Detalle' : (LABELS[segment] ?? segment)
    const isLast = index === segments.length - 1

    return { path, label, isLast }
  })

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-3 text-caption overflow-x-auto scrollbar-hide whitespace-nowrap">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} className="text-mid-gray/50" />}
          {crumb.isLast ? (
            <span className="text-dark-graphite font-medium">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="text-mid-gray hover:text-graphite transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
