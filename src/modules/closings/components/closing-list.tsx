import { useState, useMemo } from 'react'
import { ClipboardList, List, FilePlus, Percent, Trash2, SquarePen } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { formatCurrency } from '@/core/utils/format'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { usePaginatedClosings } from '../hooks'
import { closingService } from '../services'
import { ClosingForm } from './closing-form'
import { ClosingReceipt } from './closing-receipt'
import { DiscountTab } from './discount-tab'
import type { Closing } from '../types'

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

type Tab = 'form' | 'history' | 'discounts'

const CLOSING_TABS = [
  { value: 'form', label: 'Nuevo Cierre', icon: FilePlus },
  { value: 'history', label: 'Historial', icon: List },
  { value: 'discounts', label: 'Descuentos', icon: Percent },
]

export function ClosingList() {
  const { selectedCompany } = useCompany()
  const { data: closings, loading, loadingMore, hasMore, totalCount, loadMore } = usePaginatedClosings()

  const deleteMutation = useFirestoreMutation(
    'closings',
    (companyId, id: string) => closingService.remove(companyId, id),
    { optimisticDelete: true, invalidate: ['transactions'] },
  )
  const [tab, setTab] = useState<Tab>('form')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Closing | null>(null)
  const [editingClosing, setEditingClosing] = useState<Closing | null>(null)
  const [receiptClosing, setReceiptClosing] = useState<Closing | null>(null)

  const { startDate, endDate } = useDateRange()

  const sorted = useMemo(() => {
    return [...closings].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [closings])

  const dateFiltered = useMemo(() => {
    return sorted.filter((c) => {
      if (!c.date) return true
      const d = new Date(c.date + 'T12:00:00')
      return d >= startDate && d <= endDate
    })
  }, [sorted, startDate, endDate])

  const filtered = useMemo(() => {
    return dateFiltered.filter((c) => {
      if (search === '') return true
      const q = search.toLowerCase()
      return (
        (c.date ?? '').includes(q) ||
        (c.responsable ?? '').toLowerCase().includes(q)
      )
    })
  }, [dateFiltered, search])

  const totalVentas = useMemo(() => {
    return filtered.reduce((sum, c) => sum + (c.ventaTotal ?? 0), 0)
  }, [filtered])

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const columns = [
    {
      key: 'date',
      header: 'Fecha',
      width: '1fr',
      render: (c: Closing) => <span className="font-medium text-dark-graphite">{formatDate(c.date)}</span>,
    },
    {
      key: 'ventaTotal',
      header: 'Venta Total',
      width: '1fr',
      primary: true,
      render: (c: Closing) => <span className="font-semibold text-dark-graphite">{formatCurrency(c.ventaTotal ?? 0)}</span>,
    },
    {
      key: 'efectivo',
      header: 'Efectivo',
      width: '1fr',
      render: (c: Closing) => formatCurrency(c.efectivo ?? 0),
    },
    {
      key: 'datafono',
      header: 'Datáfono',
      width: '1fr',
      hideOnMobile: true,
      render: (c: Closing) => formatCurrency(c.datafono ?? 0),
    },
    {
      key: 'propinas',
      header: 'Propinas',
      width: '0.8fr',
      hideOnMobile: true,
      render: (c: Closing) => formatCurrency(c.propinas ?? 0),
    },
    {
      key: 'responsable',
      header: 'Responsable',
      width: '1.2fr',
      render: (c: Closing) => c.responsable || '—',
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (c: Closing) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setEditingClosing(c); setTab('form') }}
            className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-all duration-150"
            title="Editar"
          >
            <SquarePen size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }}
            className="p-1.5 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
            title="Eliminar"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Cierres de Caja" />

      {/* Tabs */}
      <UnderlineButtonTabs
        tabs={CLOSING_TABS}
        active={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      {/* Tab content */}
      {tab === 'form' && (
        <ClosingForm
          onSaved={() => { setEditingClosing(null) }}
          editing={editingClosing}
          onCancelEdit={() => setEditingClosing(null)}
        />
      )}

      {tab === 'history' && (
        <>
          {/* Accumulated total + period filter */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="block text-[11px] font-bold text-mid-gray uppercase tracking-wide">Acumulado</span>
              <span className="text-xl font-extrabold text-dark-graphite">{formatCurrency(totalVentas)}</span>
            </div>
            <DateRangePicker />
          </div>

          <div className="flex gap-3 mb-5">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar responsable o fecha..." />
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No hay cierres"
              description="Registra tu primer cierre en la pestaña Nuevo Cierre"
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={filtered}
                onRowClick={(c) => setReceiptClosing(c)}
              />
              <LoadMoreButton
                onClick={loadMore}
                loading={loadingMore}
                hasMore={hasMore}
                loadedCount={closings.length}
                totalCount={totalCount}
              />
            </>
          )}
        </>
      )}

      {tab === 'discounts' && <DiscountTab />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar Cierre"
        description={`¿Estás seguro de que deseas eliminar el cierre del ${deleteTarget ? formatDate(deleteTarget.date) : ''}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ClosingReceipt
        closing={receiptClosing}
        companyName={selectedCompany?.name ?? ''}
        onClose={() => setReceiptClosing(null)}
      />
    </PageTransition>
  )
}
