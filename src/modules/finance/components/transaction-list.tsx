import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, DollarSign, ChevronRight } from 'lucide-react'
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
import { useCompany } from '@/core/hooks/use-company'
import { usePaginatedTransactions, useRecurringGenerator } from '../hooks'
import { useDateRange } from '../context/date-range-context'
import { FinanceSummary } from './finance-summary'

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


export function TransactionList() {
  const navigate = useNavigate()
  const { data: transactions, loading, loadingMore, hasMore, totalCount, loadMore, refetch } = usePaginatedTransactions()
  useRecurringGenerator()
  const { startDate, endDate } = useDateRange()
  const { categories: categoryItems } = useCompany()
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

  // Group transactions by date (descending)
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; total: number; transactions: Transaction[] }[] = []
    const map = new Map<string, Transaction[]>()

    for (const t of filtered) {
      const d = t.date?.toDate?.()
      const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '0000-00-00'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }

    // Sort dates descending
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

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <DateRangePicker />
        <button
          onClick={() => { setEditingId(null); setFormOpen(true) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        >
          <Plus size={15} strokeWidth={2} />
          Nueva
        </button>
        <button
          onClick={() => navigate('/finance/import')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
        >
          <Upload size={15} strokeWidth={1.5} />
          Importar
        </button>
      </PageHeader>

      <FinanceSummary />

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
        <div className="bg-surface rounded-xl card-elevated overflow-hidden">
          {groupedByDate.map((group, gi) => {
            const isExpanded = expandedDates.has(group.dateKey)
            return (
              <div key={group.dateKey} style={{ borderBottom: gi < groupedByDate.length - 1 ? '1px solid #d4d3cf' : 'none' }}>
                {/* Date header row */}
                <button
                  onClick={() => toggleDate(group.dateKey)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-bone/50 transition-colors duration-150 text-left"
                >
                  <ChevronRight
                    size={16}
                    strokeWidth={2}
                    className={`text-mid-gray shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <span className="font-medium text-dark-graphite text-body capitalize flex-1">
                    {group.dateLabel}
                  </span>
                  <span className="text-caption text-mid-gray mr-3">
                    {group.transactions.length} {group.transactions.length === 1 ? 'transacción' : 'transacciones'}
                  </span>
                  <span className={`font-semibold text-body tabular-nums ${group.total >= 0 ? 'text-positive-text' : 'text-graphite'}`}>
                    {group.total >= 0 ? '+' : ''}{formatCurrency(group.total, 2)}
                  </span>
                </button>

                {/* Expanded transactions */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    {/* Column headers */}
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
                    {group.transactions.map((t, ti) => {
                      const typePill = getTypePill(t)
                      const catPill = getCategoryPill(t, categoryItems)
                      return (
                        <div
                          key={t.id}
                          onClick={() => { setEditingId(t.id); setFormOpen(true) }}
                          className="hidden sm:grid items-center px-5 pl-12 py-0 text-body text-graphite hover:bg-bone/50 transition-colors duration-150 cursor-pointer"
                          style={{
                            gridTemplateColumns: '2fr 0.8fr 1fr 1fr 0.8fr',
                            borderTop: '1px solid #e5e4e0',
                            borderBottom: ti === group.transactions.length - 1 ? 'none' : undefined,
                          }}
                        >
                          <div className="px-3 py-0 flex items-center gap-2">
                            <span className="font-medium text-dark-graphite">{t.concept}</span>
                            {t.sourceType === 'closing' && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Cierre</span>
                            )}
                            {t.sourceType === 'purchase' && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">Compra</span>
                            )}
                            {t.sourceType === 'recurring' && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">Recurrente</span>
                            )}
                          </div>
                          <div className="px-3 py-0 flex items-center gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${typePill.bg} ${typePill.text}`}>
                              {typePill.label}
                            </span>
                          </div>
                          <div className="px-3 py-0 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catPill.color }} />
                            <span className="truncate">{t.category}</span>
                          </div>
                          <div className="px-3 py-0 flex items-center">
                            <span className={t.type === 'income' ? 'text-positive-text font-medium' : 'text-graphite'}>
                              {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, 2)}
                            </span>
                          </div>
                          <div className="px-3 py-0 flex items-center">
                            <StatusBadge variant={t.status} />
                          </div>
                        </div>
                      )
                    })}
                    {/* Mobile card view for expanded transactions */}
                    {group.transactions.map((t, ti) => {
                      const typePill = getTypePill(t)
                      const catPill = getCategoryPill(t, categoryItems)
                      return (
                        <div
                          key={`m-${t.id}`}
                          onClick={() => { setEditingId(t.id); setFormOpen(true) }}
                          className="sm:hidden px-4 pl-10 py-3 text-body text-graphite hover:bg-bone/50 transition-colors duration-150 cursor-pointer"
                          style={{ borderTop: '1px solid #e5e4e0' }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-dark-graphite">{t.concept}</span>
                              {t.sourceType === 'closing' && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Cierre</span>
                              )}
                              {t.sourceType === 'purchase' && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">Compra</span>
                              )}
                              {t.sourceType === 'recurring' && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">Recurrente</span>
                              )}
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
                            <StatusBadge variant={t.status} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
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
