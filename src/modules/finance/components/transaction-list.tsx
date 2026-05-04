import { useState, useMemo, useRef, memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, DollarSign, ChevronRight } from 'lucide-react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { TransactionForm } from './transaction-form'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { SelectInput } from '@/core/ui/select-input'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { formatCurrency } from '@/core/utils/format'
import { parseCategory } from '@/core/utils/categories'
import { useSettings } from '@/core/hooks/use-settings'
import { usePermissions } from '@/core/hooks/use-permissions'
import { usePaginatedTransactions, useRecurringGenerator } from '../hooks'
import { useDateRange } from '../context/date-range-context'
import { FinanceSummary } from './finance-summary'
import { FinanceTabs } from './finance-tabs'

import { DateRangePicker } from './date-range-picker'
import type { Transaction } from '../types'
import type { CategoryItem } from '@/core/types/categories'

function getTypePill(t: Transaction): { label: string; bg: string; text: string } {
  if (t.type === 'income') return { label: 'Ingreso', bg: 'bg-positive-bg', text: 'text-positive-text' }
  return { label: 'Gasto', bg: 'bg-negative-bg', text: 'text-negative-text' }
}

function getCategoryPill(t: Transaction, categoryItems: CategoryItem[]): { label: string; color: string } {
  const parsed = parseCategory(t.category || '')
  const catName = parsed.category
  const catItem = categoryItems.find((c) => c.name === catName)
  const color = catItem?.color ?? '#95A5A6'
  return { label: catName || 'Otro', color }
}

type FlatItem =
  | { kind: 'header'; dateKey: string; dateLabel: string; total: number; count: number; isExpanded: boolean }
  | { kind: 'col-header'; dateKey: string }
  | { kind: 'row'; transaction: Transaction; dateKey: string; isLast: boolean }

const HeaderRow = memo(function HeaderRow({
  dateKey,
  dateLabel,
  total,
  count,
  isExpanded,
  onToggle,
}: {
  dateKey: string
  dateLabel: string
  total: number
  count: number
  isExpanded: boolean
  onToggle: (k: string) => void
}) {
  return (
    <button
      onClick={() => onToggle(dateKey)}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bone/50 transition-colors duration-150 text-left"
    >
      <ChevronRight
        size={16}
        strokeWidth={2}
        className={`text-mid-gray shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
      />
      <span className="font-medium text-dark-graphite text-body capitalize flex-1">{dateLabel}</span>
      <span className="text-caption text-mid-gray mr-3">
        {count} {count === 1 ? 'transacción' : 'transacciones'}
      </span>
      <span className={`font-semibold text-body tabular-nums ${total >= 0 ? 'text-positive-text' : 'text-graphite'}`}>
        {total >= 0 ? '+' : ''}{formatCurrency(total, 2)}
      </span>
    </button>
  )
})

const ColumnHeader = memo(function ColumnHeader() {
  return (
    <div
      className="hidden sm:grid px-5 pl-12 py-2 text-caption uppercase tracking-wider text-mid-gray bg-bone/40"
      style={{ gridTemplateColumns: '2fr 0.8fr 1fr 1fr 0.8fr', borderTop: '1px solid #e5e4e0' }}
    >
      <div className="px-3">Concepto</div>
      <div className="px-3">Tipo</div>
      <div className="px-3">Categoría</div>
      <div className="px-3">Monto</div>
      <div className="px-3">Estado</div>
    </div>
  )
})

function SourcePill({ source }: { source: Transaction['sourceType'] }) {
  if (source === 'closing') return <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Cierre</span>
  if (source === 'purchase') return <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">Compra</span>
  if (source === 'recurring') return <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">Recurrente</span>
  return null
}

const TransactionRow = memo(function TransactionRow({
  t,
  isLast,
  categoryItems,
  onClick,
}: {
  t: Transaction
  isLast: boolean
  categoryItems: CategoryItem[]
  onClick: (id: string) => void
}) {
  const typePill = getTypePill(t)
  const catPill = getCategoryPill(t, categoryItems)
  return (
    <>
      {/* Desktop row */}
      <div
        onClick={() => onClick(t.id)}
        className="hidden sm:grid items-center px-5 pl-12 py-2 text-body text-graphite hover:bg-bone/50 transition-colors duration-150 cursor-pointer"
        style={{
          gridTemplateColumns: '2fr 0.8fr 1fr 1fr 0.8fr',
          borderTop: '1px solid #e5e4e0',
          borderBottom: isLast ? 'none' : undefined,
        }}
      >
        <div className="px-3 flex items-center gap-2">
          <span className="font-medium text-dark-graphite">{t.concept}</span>
          <SourcePill source={t.sourceType} />
        </div>
        <div className="px-3 flex items-center gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${typePill.bg} ${typePill.text}`}>
            {typePill.label}
          </span>
        </div>
        <div className="px-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catPill.color }} />
          <span className="truncate">{t.category}</span>
        </div>
        <div className="px-3 flex items-center">
          <span className={t.type === 'income' ? 'text-positive-text font-medium' : 'text-graphite'}>
            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, 2)}
          </span>
        </div>
        <div className="px-3 flex items-center">
          <StatusBadge variant={t.status} size="sm" />
        </div>
      </div>
      {/* Mobile card */}
      <div
        onClick={() => onClick(t.id)}
        className="sm:hidden px-4 pl-10 py-3 text-body text-graphite hover:bg-bone/50 transition-colors duration-150 cursor-pointer"
        style={{ borderTop: '1px solid #e5e4e0' }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-dark-graphite">{t.concept}</span>
            <SourcePill source={t.sourceType} />
          </div>
          <span className={t.type === 'income' ? 'text-positive-text font-medium' : 'text-graphite'}>
            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, 2)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-caption">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${typePill.bg} ${typePill.text}`}>
            {typePill.label}
          </span>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catPill.color }} />
          <span className="truncate text-mid-gray">{t.category}</span>
          <StatusBadge variant={t.status} size="sm" />
        </div>
      </div>
    </>
  )
})

export function TransactionList() {
  const navigate = useNavigate()
  const { data: transactions, loading, loadingMore, hasMore, totalCount, loadMore, refetch } = usePaginatedTransactions()
  useRecurringGenerator()
  const { startDate, endDate } = useDateRange()
  const { categories: categoryItems } = useSettings()
  const { can } = usePermissions()
  const canEdit = can('finance', 'create')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const categories = useMemo(() => {
    const set = new Set(transactions.map((t) => t.category).filter(Boolean))
    return Array.from(set).sort()
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        search === '' || t.concept.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === '' || t.category === categoryFilter || t.category.startsWith(categoryFilter + ' > ')
      const matchesType = typeFilter === '' || t.type === typeFilter
      const matchesStatus = statusFilter === '' || t.status === statusFilter

      const txDate = t.date?.toDate?.()
      const matchesDate = txDate ? (txDate >= startDate && txDate <= endDate) : true

      return matchesSearch && matchesCategory && matchesType && matchesStatus && matchesDate
    })
  }, [transactions, search, categoryFilter, typeFilter, statusFilter, startDate.getTime(), endDate.getTime()])

  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; total: number; transactions: Transaction[] }[] = []
    const map = new Map<string, Transaction[]>()

    for (const t of filtered) {
      const d = t.date?.toDate?.()
      const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '0000-00-00'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }

    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))

    for (const key of sortedKeys) {
      const txs = map.get(key)!
      const d = txs[0].date?.toDate?.()
      const dateLabel = d
        ? d.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : 'Sin fecha'
      const total = txs.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)
      groups.push({ dateKey: key, dateLabel, total, transactions: txs })
    }

    return groups
  }, [filtered])

  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  // Estables para que HeaderRow/TransactionRow (memo) no re-rendericen
  // cuando el padre re-renderiza por filtros, search, o load-more.
  const toggleDate = useCallback((dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }, [])

  const handleRowClick = useCallback((id: string) => {
    setEditingId(id)
    setFormOpen(true)
  }, [])

  // Aplana grupos + transacciones expandidas en una sola lista plana para
  // virtualizar. Cuando todas las fechas estan colapsadas el virtualizer solo
  // pinta cabeceras (1 row por dia, ~30 rows tipico). Al expandir, agrega
  // col-header + filas. La altura real la mide measureElement por item, asi
  // mobile (88px card) y desktop (46px row) coexisten sin saltos.
  const flatItems = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = []
    for (const g of groupedByDate) {
      const isExpanded = expandedDates.has(g.dateKey)
      out.push({ kind: 'header', dateKey: g.dateKey, dateLabel: g.dateLabel, total: g.total, count: g.transactions.length, isExpanded })
      if (isExpanded) {
        out.push({ kind: 'col-header', dateKey: g.dateKey })
        g.transactions.forEach((t, i) => {
          out.push({ kind: 'row', transaction: t, dateKey: g.dateKey, isLast: i === g.transactions.length - 1 })
        })
      }
    }
    return out
  }, [groupedByDate, expandedDates])

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useWindowVirtualizer({
    count: flatItems.length,
    estimateSize: (index) => {
      const item = flatItems[index]
      if (item.kind === 'header') return 56
      if (item.kind === 'col-header') return 36
      return 88 // row pesimista (mobile card); measureElement corrige en desktop
    },
    overscan: 6,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  })

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <DateRangePicker />
        {canEdit && (
          <>
            <button
              onClick={() => { setEditingId(null); setFormOpen(true) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200"
            >
              <Plus size={15} strokeWidth={2} />
              Nueva
            </button>
            <button
              onClick={() => navigate('/finance/import')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              <Upload size={15} strokeWidth={1.5} />
              Importar
            </button>
          </>
        )}
      </PageHeader>

      <FinanceSummary />
      <FinanceTabs />

      <div className="flex gap-3 mb-5">
        <div className="flex-1 min-w-0 sm:min-w-[180px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar transacción..." />
        </div>
        <FilterPopover
          activeCount={[categoryFilter, typeFilter, statusFilter].filter(Boolean).length}
          onClear={() => {
            setCategoryFilter('')
            setTypeFilter('')
            setStatusFilter('')
          }}
        >
          <div>
            <label className="block text-caption text-mid-gray mb-1">Categoría</label>
            <SelectInput
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="Todas las categorías"
              options={[
                { value: '', label: 'Todas las categorías' },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
          <div>
            <label className="block text-caption text-mid-gray mb-1">Tipo</label>
            <SelectInput
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="Todos"
              options={[
                { value: '', label: 'Todos' },
                { value: 'income', label: 'Ingreso' },
                { value: 'expense', label: 'Gasto' },
              ]}
            />
          </div>
          <div>
            <label className="block text-caption text-mid-gray mb-1">Estado</label>
            <SelectInput
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Todos los estados"
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'paid', label: 'Pagado' },
                { value: 'pending', label: 'Pendiente' },
                { value: 'overdue', label: 'Vencido' },
              ]}
            />
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No hay transacciones"
          description="Registra tu primera transacción usando el botón + Nueva"
        />
      ) : (
        <>
          <div ref={parentRef} className="bg-surface rounded-xl card-elevated overflow-hidden">
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = flatItems[virtualRow.index]
                const offsetTop = virtualRow.start - (parentRef.current?.offsetTop ?? 0)
                return (
                  <div
                    key={
                      item.kind === 'header' ? `h-${item.dateKey}` :
                      item.kind === 'col-header' ? `c-${item.dateKey}` :
                      `r-${item.transaction.id}`
                    }
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${offsetTop}px)`,
                    }}
                  >
                    {item.kind === 'header' ? (
                      <HeaderRow
                        dateKey={item.dateKey}
                        dateLabel={item.dateLabel}
                        total={item.total}
                        count={item.count}
                        isExpanded={item.isExpanded}
                        onToggle={toggleDate}
                      />
                    ) : item.kind === 'col-header' ? (
                      <ColumnHeader />
                    ) : (
                      <TransactionRow
                        t={item.transaction}
                        isLast={item.isLast}
                        categoryItems={categoryItems}
                        onClick={handleRowClick}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <LoadMoreButton
            onClick={loadMore}
            loading={loadingMore}
            hasMore={hasMore}
            loadedCount={transactions.length}
            totalCount={totalCount}
          />
        </>
      )}

      <TransactionForm
        open={formOpen}
        transactionId={editingId}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); refetch() }}
      />
    </PageTransition>
  )
}
