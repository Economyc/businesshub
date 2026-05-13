import { useState, useMemo } from 'react'
import { ClipboardList, List, FilePlus, Trash2, SquarePen, UserCircle, CalendarRange, TrendingUp, Wallet, CreditCard, QrCode, Bike, Coins, Receipt, CalendarCheck, HandCoins } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton, KPICardSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { KPICard } from '@/core/ui/kpi-card'
import { SelectInput, type SelectOption } from '@/core/ui/select-input'
import { HoverHint } from '@/components/ui/tooltip'
import { formatCurrency } from '@/core/utils/format'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { usePaginatedClosings, useClosings } from '../hooks'
import { closingService } from '../services'
import { ClosingForm } from './closing-form'
import { ClosingReceipt } from './closing-receipt'
import type { Closing } from '../types'

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).toUpperCase()
}

function ClosingCard({ closing, onEdit, onDelete, onClick, canEdit }: { closing: Closing; onEdit: () => void; onDelete: () => void; onClick: () => void; canEdit: boolean }) {
  return (
    <article
      onClick={onClick}
      className="bg-surface rounded-xl card-elevated p-4 relative cursor-pointer active:bg-bone/50 transition-colors"
    >
      {/* Edit button */}
      {canEdit && (
        <div className="absolute top-3 right-3 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="w-8 h-8 rounded-full bg-bone flex items-center justify-center text-graphite active:bg-border transition-colors"
          >
            <SquarePen size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="w-8 h-8 rounded-full bg-bone flex items-center justify-center text-mid-gray active:bg-red-100 active:text-red-500 transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Header: date badge + responsable */}
      <div className="border-b border-bone pb-3 mb-3 pr-20">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-dark-graphite text-white text-[10px] font-bold px-2 py-0.5 rounded">
            {formatShortDate(closing.date)}
          </span>
        </div>
        <h3 className="text-[14px] font-bold text-dark-graphite flex items-center gap-1.5">
          <UserCircle size={16} className="text-mid-gray" />
          {closing.responsable || '—'}
        </h3>
      </div>

      {/* 2x2 grid of values */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
        <div>
          <span className="block text-[10px] font-bold text-mid-gray uppercase mb-0.5">Venta Total</span>
          <span className="block font-extrabold text-emerald-700">{formatCurrency(closing.ventaTotal ?? 0)}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-mid-gray uppercase mb-0.5">Efectivo</span>
          <span className="block font-bold text-dark-graphite">{formatCurrency(closing.efectivo ?? 0)}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-mid-gray uppercase mb-0.5">Datáfono</span>
          <span className="block font-bold text-dark-graphite">{formatCurrency(closing.datafono ?? 0)}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-mid-gray uppercase mb-0.5">Propinas</span>
          <span className="block font-bold text-dark-graphite">{formatCurrency(closing.propinas ?? 0)}</span>
        </div>
      </div>
    </article>
  )
}

function BreakdownStat({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} strokeWidth={1.5} className="text-mid-gray" />
        <span className="text-caption font-semibold text-mid-gray uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className="text-subheading font-semibold text-dark-graphite">{formatCurrency(value)}</div>
    </div>
  )
}

type Tab = 'form' | 'history' | 'accumulated'

const CLOSING_TABS = [
  { value: 'form', label: 'Nuevo Cierre', icon: FilePlus },
  { value: 'history', label: 'Cierres', icon: List },
  { value: 'accumulated', label: 'Acumulado', icon: TrendingUp },
]

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function monthValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthOptions(count = 18): SelectOption[] {
  const now = new Date()
  const opts: SelectOption[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({ value: monthValue(d), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` })
  }
  return opts
}

interface AccumulatedTabProps {
  canEdit: boolean
  onEdit: (c: Closing) => void
  onDelete: (c: Closing) => void
  onRowClick: (c: Closing) => void
}

function AccumulatedTab({ canEdit, onEdit, onDelete, onRowClick }: AccumulatedTabProps) {
  const { data: closings, loading } = useClosings()
  const monthOptions = useMemo(() => buildMonthOptions(), [])
  const [month, setMonth] = useState(() => monthValue(new Date()))

  const monthClosings = useMemo(
    () =>
      closings
        .filter((c) => (c.date ?? '').startsWith(month))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [closings, month],
  )

  const totals = useMemo(() => {
    return monthClosings.reduce(
      (acc, c) => ({
        ventaTotal: acc.ventaTotal + (c.ventaTotal ?? 0),
        efectivo: acc.efectivo + (c.efectivo ?? 0),
        datafono: acc.datafono + (c.datafono ?? 0),
        ap: acc.ap + (c.ap ?? 0),
        qr: acc.qr + (c.qr ?? 0),
        rappiVentas: acc.rappiVentas + (c.rappiVentas ?? 0),
        propinas: acc.propinas + (c.propinas ?? 0),
        gastos: acc.gastos + (c.gastos ?? 0),
        entregaEfectivo: acc.entregaEfectivo + (c.entregaEfectivo ?? 0),
      }),
      { ventaTotal: 0, efectivo: 0, datafono: 0, ap: 0, qr: 0, rappiVentas: 0, propinas: 0, gastos: 0, entregaEfectivo: 0 },
    )
  }, [monthClosings])

  const isCurrentMonth = month === monthValue(new Date())

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
      key: 'entregaEfectivo',
      header: 'Efectivo Entregado',
      width: '1fr',
      hideOnMobile: true,
      render: (c: Closing) => formatCurrency(c.entregaEfectivo ?? 0),
    },
    {
      key: 'responsable',
      header: 'Responsable',
      width: '1.2fr',
      render: (c: Closing) => c.responsable || '—',
    },
  ]

  return (
    <>
      {/* Month filter */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <span className="text-[11px] font-bold text-mid-gray uppercase tracking-wide">
          {isCurrentMonth ? 'Acumulado del mes en curso' : 'Acumulado del mes'}
        </span>
        <SelectInput value={month} onChange={setMonth} options={monthOptions} className="w-44 shrink-0" />
      </div>

      {loading ? (
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
          </div>
          <div className="rounded-xl bg-smoke animate-pulse h-28" />
        </div>
      ) : (
        <>
          {/* KPIs hero */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KPICard label="Venta Total" value={totals.ventaTotal} format="currency" icon={TrendingUp} />
            <KPICard label="Venta Efectivo" value={totals.efectivo - totals.ap} format="currency" icon={Wallet} />
            <KPICard label="Venta Datáfono" value={totals.datafono} format="currency" icon={CreditCard} />
            <KPICard label="Días con cierre" value={monthClosings.length} format="number" icon={CalendarCheck} />
          </div>

          {/* Desglose de otros medios y movimientos */}
          <div className="bg-surface rounded-xl card-elevated overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-border">
              <span className="text-caption font-semibold text-mid-gray uppercase tracking-wider">Otros medios y movimientos del mes</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border/60">
              <BreakdownStat label="QR" value={totals.qr} icon={QrCode} />
              <BreakdownStat label="Rappi" value={totals.rappiVentas} icon={Bike} />
              <BreakdownStat label="Propinas" value={totals.propinas} icon={Coins} />
              <BreakdownStat label="Gastos" value={totals.gastos} icon={Receipt} />
              <BreakdownStat label="Efectivo Entregado" value={totals.entregaEfectivo} icon={HandCoins} />
            </div>
          </div>

          {monthClosings.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="Sin cierres este mes"
              description="No hay cierres registrados en el mes seleccionado"
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 md:hidden">
                {monthClosings.map((c) => (
                  <ClosingCard
                    key={c.id}
                    closing={c}
                    canEdit={canEdit}
                    onEdit={() => onEdit(c)}
                    onDelete={() => onDelete(c)}
                    onClick={() => onRowClick(c)}
                  />
                ))}
              </div>
              <div className="hidden md:block">
                <DataTable columns={columns} data={monthClosings} onRowClick={onRowClick} />
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

export function ClosingList() {
  const { selectedCompany } = useCompany()
  const { can } = usePermissions()
  const canEdit = can('closings', 'create')
  const { data: closings, loading, loadingMore, hasMore, totalCount, loadMore } = usePaginatedClosings()

  const deleteMutation = useFirestoreMutation(
    'closings',
    (companyId, id: string) => closingService.remove(companyId, id),
    { optimisticDelete: true, invalidate: ['transactions'] },
  )
  const [tab, setTab] = useState<Tab>(canEdit ? 'form' : 'history')
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
      render: (c: Closing) => canEdit ? (
        <div className="flex items-center gap-1">
          <HoverHint label="Editar">
            <button
              onClick={(e) => { e.stopPropagation(); setEditingClosing(c); setTab('form') }}
              className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-all duration-150"
            >
              <SquarePen size={14} strokeWidth={1.5} />
            </button>
          </HoverHint>
          <HoverHint label="Eliminar">
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }}
              className="p-1.5 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </HoverHint>
        </div>
      ) : null,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Cierres de Caja" />

      {/* Tabs */}
      <UnderlineButtonTabs
        tabs={canEdit ? CLOSING_TABS : CLOSING_TABS.filter((t) => t.value !== 'form')}
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
              {/* Mobile: custom cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {filtered.map((c) => (
                  <ClosingCard
                    key={c.id}
                    closing={c}
                    canEdit={canEdit}
                    onEdit={() => { setEditingClosing(c); setTab('form') }}
                    onDelete={() => setDeleteTarget(c)}
                    onClick={() => setReceiptClosing(c)}
                  />
                ))}
              </div>
              {/* Desktop: full table */}
              <div className="hidden md:block">
                <DataTable
                  columns={columns}
                  data={filtered}
                  onRowClick={(c) => setReceiptClosing(c)}
                />
              </div>
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

      {tab === 'accumulated' && (
        <AccumulatedTab
          canEdit={canEdit}
          onEdit={(c) => { setEditingClosing(c); setTab('form') }}
          onDelete={(c) => setDeleteTarget(c)}
          onRowClick={(c) => setReceiptClosing(c)}
        />
      )}

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
