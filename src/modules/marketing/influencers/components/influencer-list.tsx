import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Megaphone, DollarSign, Image } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { TableSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { usePermissions } from '@/core/hooks/use-permissions'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePaginatedInfluencerVisits } from '../hooks'
import { InfluencerForm } from './influencer-form'
import type { InfluencerVisit, SocialPlatform } from '../types'

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
  const { startDate, endDate } = useDateRange()
  const { can } = usePermissions()
  const canEdit = can('marketing', 'create')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingVisit, setEditingVisit] = useState<InfluencerVisit | null>(null)

  const filtered = useMemo(() => {
    return visits.filter((v) => {
      const matchesSearch =
        search === '' ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.socialNetworks?.some((s) => s.handle.toLowerCase().includes(search.toLowerCase()))
      const visitDate = v.visitDate?.toDate()
      const matchesDate = !visitDate || (visitDate >= startDate && visitDate <= endDate)
      return matchesSearch && matchesDate
    })
  }, [visits, search, startDate, endDate])

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

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-3 gap-4 mb-5"
      >
        <KPICard
          label="Gasto total"
          value={totalCost}
          format="currency"
          icon={DollarSign}
        />
        <KPICard
          label="Con contenido"
          value={withContent}
          format="number"
          change={`${contentPercent}% del total`}
          trend={contentPercent >= 50 ? 'up' : contentPercent > 0 ? 'neutral' : 'down'}
          icon={Image}
        />
        <KPICard
          label="Total visitas"
          value={totalVisits}
          format="number"
          icon={Megaphone}
        />
      </motion.div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar influencer..." />
        </div>
        <DateRangePicker />
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
