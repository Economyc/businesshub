import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Megaphone, DollarSign, Clock, Instagram, Youtube, Facebook, Twitter } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { TableSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { HoverHint } from '@/components/ui/tooltip'
import { usePermissions } from '@/core/hooks/use-permissions'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { usePaginatedInfluencerVisits } from '../hooks'
import { InfluencerForm } from './influencer-form'
import type { InfluencerVisit, SocialPlatform, ContentChecklist } from '../types'
import type { LucideIcon } from 'lucide-react'

const PLATFORM_ICON: Record<SocialPlatform, LucideIcon | null> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  twitter: Twitter,
  tiktok: null,
  other: null,
}

const PLATFORM_SHORT: Record<SocialPlatform, string> = {
  instagram: 'IG',
  tiktok: 'TK',
  youtube: 'YT',
  facebook: 'FB',
  twitter: 'X',
  other: '··',
}

const CONTENT_LABELS: Array<{ key: keyof ContentChecklist; label: string }> = [
  { key: 'story', label: 'Story' },
  { key: 'post', label: 'Post' },
  { key: 'reel', label: 'Reel' },
]

function formatDate(ts: { toDate: () => Date } | undefined): string {
  if (!ts) return '—'
  const d = ts.toDate()
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PlatformIcon({ platform }: { platform: SocialPlatform }) {
  const Icon = PLATFORM_ICON[platform]
  if (Icon) return <Icon size={12} strokeWidth={1.8} />
  return <span className="text-[9px] font-bold leading-none">{PLATFORM_SHORT[platform]}</span>
}

function ContentPills({ content }: { content: ContentChecklist | undefined }) {
  return (
    <div className="flex items-center gap-1">
      {CONTENT_LABELS.map(({ key, label }) => {
        const active = content?.[key]
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide transition-colors ${
              active
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/25 dark:text-emerald-300'
                : 'bg-bone text-mid-gray ring-1 ring-black/5'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-smoke'}`} />
            {label}
          </span>
        )
      })}
    </div>
  )
}

function deliveryScore(content: ContentChecklist | undefined): number {
  if (!content) return 0
  return (content.story ? 1 : 0) + (content.post ? 1 : 0) + (content.reel ? 1 : 0)
}

function CanjeCell({ visit }: { visit: InfluencerVisit }) {
  if (!visit.order) return <span className="text-mid-gray">—</span>
  const delivered = deliveryScore(visit.content)
  const dot =
    delivered === 0
      ? 'bg-red-500'
      : delivered < 3
        ? 'bg-amber-500'
        : 'bg-emerald-500'
  const title =
    delivered === 0
      ? 'Sin contenido entregado'
      : delivered < 3
        ? `${delivered}/3 piezas entregadas`
        : 'Canje completo'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <HoverHint label={title}>
        <span className={`shrink-0 w-2 h-2 rounded-full ${dot}`} />
      </HoverHint>
      <div className="flex flex-col min-w-0">
        <span className="text-dark-graphite font-medium truncate">{formatCurrency(visit.order.total)}</span>
        <span className="text-[10px] text-mid-gray truncate">{visit.order.documento}</span>
      </div>
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

  const stats = useMemo(() => {
    let totalCost = 0
    let pendingCost = 0
    let withContent = 0
    for (const v of filtered) {
      const cost = v.order?.total ?? 0
      totalCost += cost
      const delivered = deliveryScore(v.content)
      if (delivered > 0) withContent++
      if (delivered < 3) pendingCost += cost
    }
    return { totalCost, pendingCost, withContent, total: filtered.length }
  }, [filtered])

  const contentPercent = stats.total > 0 ? Math.round((stats.withContent / stats.total) * 100) : 0
  const pendingPercent = stats.totalCost > 0 ? Math.round((stats.pendingCost / stats.totalCost) * 100) : 0

  const columns = [
    {
      key: 'name',
      header: 'Influencer',
      width: '2fr',
      render: (v: InfluencerVisit) => {
        const primary = v.socialNetworks?.[0]
        const extra = (v.socialNetworks?.length ?? 0) - 1
        return (
          <div className="min-w-0">
            <div className="font-medium text-dark-graphite truncate">{v.name}</div>
            {primary && (
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-mid-gray">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-bone text-graphite">
                  <PlatformIcon platform={primary.platform} />
                </span>
                <span className="truncate">@{primary.handle}</span>
                {extra > 0 && (
                  <span className="text-smoke">+{extra}</span>
                )}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'visitDate',
      header: 'Fecha',
      width: '1fr',
      render: (v: InfluencerVisit) => <span className="text-graphite">{formatDate(v.visitDate)}</span>,
    },
    {
      key: 'canje',
      header: 'Canje',
      width: '1.3fr',
      render: (v: InfluencerVisit) => <CanjeCell visit={v} />,
    },
    {
      key: 'content',
      header: 'Contenido',
      width: '1.4fr',
      render: (v: InfluencerVisit) => <ContentPills content={v.content} />,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Influencers">
        {canEdit && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200"
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
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5"
      >
        <KPICard
          label="Inversión en canjes"
          value={stats.totalCost}
          format="currency"
          icon={DollarSign}
          change={`${stats.total} ${stats.total === 1 ? 'visita' : 'visitas'}`}
          trend="neutral"
        />
        <KPICard
          label="Canjes pendientes"
          value={stats.pendingCost}
          format="currency"
          icon={Clock}
          change={pendingPercent > 0 ? `${pendingPercent}% sin entregar` : 'Todo entregado'}
          trend={pendingPercent === 0 ? 'up' : pendingPercent >= 50 ? 'down' : 'neutral'}
        />
        <KPICard
          label="Con contenido"
          value={stats.withContent}
          format="number"
          icon={Megaphone}
          change={`${contentPercent}% del total`}
          trend={contentPercent >= 70 ? 'up' : contentPercent >= 30 ? 'neutral' : 'down'}
        />
      </motion.div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o @handle..." />
        </div>
        <DateRangePicker />
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={4} />
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
