import { useState, useMemo } from 'react'
import { Plus, Megaphone, Instagram, Video, Image, BookOpen } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { TableSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { usePermissions } from '@/core/hooks/use-permissions'
import { SelectInput } from '@/core/ui/select-input'
import { usePaginatedInfluencerVisits } from '../hooks'
import { InfluencerForm } from './influencer-form'
import type { InfluencerVisit, SocialPlatform } from '../types'

const FILTER_STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'completed', label: 'Completado' },
]

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'IG',
  tiktok: 'TK',
  youtube: 'YT',
  facebook: 'FB',
  twitter: 'X',
  other: '...',
}

function formatDate(ts: { toDate: () => Date } | undefined): string {
  if (!ts) return '—'
  const d = ts.toDate()
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ContentDots({ content }: { content: InfluencerVisit['content'] }) {
  const items = [
    { key: 'story', label: 'Story', active: content?.story },
    { key: 'post', label: 'Post', active: content?.post },
    { key: 'reel', label: 'Reel', active: content?.reel },
  ]
  return (
    <div className="flex items-center gap-1.5">
      {items.map((item) => (
        <span
          key={item.key}
          title={item.label}
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-semibold transition-colors ${
            item.active
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
          }`}
        >
          {item.label[0]}
        </span>
      ))}
    </div>
  )
}

export function InfluencerList() {
  const { data: visits, loading, loadingMore, hasMore, totalCount, loadMore, refetch } = usePaginatedInfluencerVisits()
  const { can } = usePermissions()
  const canEdit = can('marketing', 'create')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingVisit, setEditingVisit] = useState<InfluencerVisit | null>(null)

  const filtered = useMemo(() => {
    return visits.filter((v) => {
      const matchesSearch =
        search === '' ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.socialNetworks?.some((s) => s.handle.toLowerCase().includes(search.toLowerCase()))
      const matchesStatus = statusFilter === '' || v.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [visits, search, statusFilter])

  const totalVisits = filtered.length
  const withContent = useMemo(() => {
    return filtered.filter((v) => v.content?.story || v.content?.post || v.content?.reel).length
  }, [filtered])
  const contentPercent = totalVisits > 0 ? Math.round((withContent / totalVisits) * 100) : 0
  const totalCost = useMemo(() => {
    return filtered.reduce((sum, v) => sum + (v.order?.total ?? 0), 0)
  }, [filtered])

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      width: '2fr',
      render: (v: InfluencerVisit) => (
        <div>
          <span className="font-medium text-dark-graphite">{v.name}</span>
          {v.socialNetworks?.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              {v.socialNetworks.map((s, i) => (
                <span key={i} className="text-[10px] text-mid-gray bg-bone px-1.5 py-0.5 rounded">
                  {PLATFORM_LABELS[s.platform]}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'visitDate',
      header: 'Fecha',
      width: '1fr',
      render: (v: InfluencerVisit) => formatDate(v.visitDate),
    },
    {
      key: 'order',
      header: 'Pedido',
      width: '1.5fr',
      render: (v: InfluencerVisit) =>
        v.order ? (
          <div>
            <span className="text-graphite">{v.order.documento}</span>
            <span className="text-mid-gray ml-2">{formatCurrency(v.order.total)}</span>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'content',
      header: 'Contenido',
      width: '1fr',
      render: (v: InfluencerVisit) => <ContentDots content={v.content} />,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (v: InfluencerVisit) => <StatusBadge variant={v.status} />,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Influencers">
        {canEdit && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
          >
            <Plus size={15} strokeWidth={2} />
            Nuevo
          </button>
        )}
      </PageHeader>

      <InfluencerForm
        open={showForm || !!editingVisit}
        visit={editingVisit}
        onClose={() => { setShowForm(false); setEditingVisit(null); refetch() }}
      />

      <div className="flex gap-4 mb-4 text-caption text-mid-gray">
        <span>
          Visitas:{' '}
          <span className="font-medium text-graphite">{totalVisits}</span>
        </span>
        <span>
          Con contenido:{' '}
          <span className="font-medium text-graphite">{contentPercent}%</span>
        </span>
        <span>
          Costo total:{' '}
          <span className="font-medium text-graphite">{formatCurrency(totalCost)}</span>
        </span>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar influencer..." />
        </div>
        <FilterPopover
          activeCount={[statusFilter].filter(Boolean).length}
          onClear={() => setStatusFilter('')}
        >
          <div>
            <label className="block text-caption text-mid-gray mb-1">Estado</label>
            <SelectInput
              value={statusFilter}
              onChange={setStatusFilter}
              options={FILTER_STATUS_OPTIONS}
              placeholder="Todos los estados"
            />
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No hay influencers"
          description="Registra tu primera visita de influencer usando el botón + Nuevo"
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(v) => setEditingVisit(v)}
          />
          <LoadMoreButton
            onClick={loadMore}
            loading={loadingMore}
            hasMore={hasMore}
            loadedCount={visits.length}
            totalCount={totalCount}
          />
        </>
      )}
    </PageTransition>
  )
}
