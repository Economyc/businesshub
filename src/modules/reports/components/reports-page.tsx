import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Bike, Calculator, ChevronRight, FileSpreadsheet, Scale, ListChecks, SearchX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/core/ui/page-header'
import { PageTransition } from '@/core/ui/page-transition'
import { SearchInput } from '@/core/ui/search-input'
import { EmptyState } from '@/core/ui/empty-state'
import { currentYm } from '@/core/ui/month-picker'
import { prevMonthOf, monthRange } from '@/core/pnl/month.ts'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { TAB_IDS } from '@/core/config/access-registry'
import { useClosing } from '../closing/use-closing'
import { companyDisplayName } from '../domain/export'
import { REPORTS } from '../registry'

interface SectionItem {
  label: string
  icon: LucideIcon
  to: string
  /** Texto extra por el que también se encuentra (p. ej. las hojas del Excel). */
  keywords?: string
}

interface Section {
  id: string
  to: string
  icon: LucideIcon
  title: string
  description: string
  items: SectionItem[]
}

/** Minúsculas y sin tildes: "franja" encuentra "Franja", "dia" encuentra "día". */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Índice de /informes: una tarjeta por sección y un buscador que filtra los
 * informes de todas a la vez. Cada sección vive en su propia subruta, así que el
 * hub no carga las ventas del POS; sólo el cierre, que son dos documentos.
 */
export function ReportsPage() {
  const { selectedCompany } = useCompany()
  const { canAccessTab } = usePermissions()
  const [query, setQuery] = useState('')
  const closingYm = prevMonthOf(currentYm())

  // El cierre trae el Estado de Resultados completo y tiene permiso propio:
  // quien sólo ve domicilios (mercadeo) no necesita el índice.
  const verCierre = canAccessTab(TAB_IDS.reportsCierre)

  const sections = useMemo<Section[]>(() => {
    const closingTo = `/informes/cierre?mes=${closingYm}`
    return [
      {
        id: 'domicilios',
        to: '/informes/domicilios',
        icon: Bike,
        title: 'Domicilios',
        description: 'Ventas, horarios y productos por canal: Rappi, DiDi, Web y teléfono.',
        items: REPORTS.map((r) => ({
          label: r.title,
          icon: r.icon,
          to: `/informes/domicilios/${r.id}`,
          keywords: r.sheets.map((s) => s.label).join(' '),
        })),
      },
      {
        id: 'cierre',
        to: closingTo,
        icon: Calculator,
        title: 'Cierre mensual',
        description: 'Estado de Resultados, puente a la caja y ajustes del mes.',
        items: [
          { label: 'Estado de Resultados', icon: FileSpreadsheet, to: closingTo, keywords: 'p&l pyg utilidad ebitda ventas' },
          { label: 'Puente a la caja', icon: Scale, to: closingTo, keywords: 'caja flujo' },
          { label: 'Ajustes del mes', icon: ListChecks, to: closingTo, keywords: 'captura manual' },
        ],
      },
    ]
  }, [closingYm])

  const q = normalize(query.trim())
  const visible = useMemo(() => {
    if (!q) return sections
    return sections
      .map((section) => {
        // Si coincide la sección, se ven todos sus informes.
        if (normalize(section.title).includes(q)) return section
        const items = section.items.filter((i) => normalize(`${i.label} ${i.keywords ?? ''}`).includes(q))
        return { ...section, items }
      })
      .filter((section) => section.items.length > 0)
  }, [sections, q])

  if (!verCierre) return <Navigate to="/informes/domicilios" replace />

  return (
    <PageTransition>
      <PageHeader
        title="Informes"
        subtitle={<span className="text-body text-mid-gray">{companyDisplayName(selectedCompany)}</span>}
      />

      <div className="mb-6 max-w-md">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar informe…" />
      </div>

      {visible.length === 0 ? (
        <div className="bg-card-bg rounded-xl card-elevated">
          <EmptyState icon={SearchX} title="Sin resultados" description={`Ningún informe coincide con “${query.trim()}”.`} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 auto-rows-fr">
          {visible.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              badge={section.id === 'cierre' ? <ClosingBadge ym={closingYm} /> : null}
            />
          ))}
        </div>
      )}
    </PageTransition>
  )
}

/** Mes del cierre: verde si ya hay base calculada. */
function ClosingBadge({ ym }: { ym: string }) {
  const { snapshot, loading } = useClosing(ym)
  if (loading) return null
  return <Badge variant={snapshot ? 'positive' : 'outline'}>{monthRange(ym).label}</Badge>
}

function SectionCard({ section, badge }: { section: Section; badge: ReactNode }) {
  const { to, icon: Icon, title, description, items } = section
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl card-elevated bg-card-bg p-6">
      <Link to={to} className="group space-y-4">
        <div className="flex items-start justify-between gap-4">
          <span className="size-10 rounded-xl bg-bone text-mid-gray flex items-center justify-center shrink-0">
            <Icon size={20} strokeWidth={1.5} />
          </span>
          {badge}
        </div>
        <div className="space-y-1">
          <h2 className="flex items-center gap-1 text-subheading font-medium text-dark-graphite">
            {title}
            <ChevronRight size={16} strokeWidth={1.5} className="text-mid-gray transition-transform group-hover:translate-x-0.5" />
          </h2>
          <p className="text-caption text-mid-gray">{description}</p>
        </div>
      </Link>

      <ul className="-mx-2 space-y-1">
        {items.map(({ label, icon: ItemIcon, to: itemTo }) => (
          <li key={label}>
            <Link
              to={itemTo}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-caption text-graphite transition-colors hover:bg-bone hover:text-dark-graphite"
            >
              <ItemIcon size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
