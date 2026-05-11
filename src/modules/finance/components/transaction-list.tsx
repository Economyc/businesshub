import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Sparkles, FileText, Receipt } from 'lucide-react'
import { TransactionForm } from './transaction-form'
import { DocumentUploadDialog } from './document-upload-dialog'
import { PaymentUploadDialog } from './payment-upload-dialog'
import type { DocumentKind, Transaction } from '../types'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { SelectInput } from '@/core/ui/select-input'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { DataTable, type Column } from '@/core/ui/data-table'
import { formatCurrency } from '@/core/utils/format'
import { parseCategory } from '@/core/utils/categories'
import { useSettings } from '@/core/hooks/use-settings'
import { usePermissions } from '@/core/hooks/use-permissions'
import { usePaginatedTransactions, useRecurringGenerator } from '../hooks'
import { useDateRange } from '../context/date-range-context'
import { InvoicesSummary } from './invoices-summary'

import { DateRangePicker } from './date-range-picker'
import type { CategoryItem } from '@/core/types/categories'
import { useInlineAgent } from '@/modules/agent/hooks/use-inline-agent'
import { InlineAgentSheet } from '@/modules/agent/components/inline-agent-sheet'

type TabKey = 'pending' | 'paid'

function formatDate(ts: Transaction['date']): string {
  const d = ts?.toDate?.()
  if (!d) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function getCategoryColor(category: string, categoryItems: CategoryItem[]): string {
  const parsed = parseCategory(category || '')
  const item = categoryItems.find((c) => c.name === parsed.category)
  return item?.color ?? '#95A5A6'
}

function PriorityPill({ priority }: { priority?: Transaction['priority'] }) {
  const isImmediate = priority === 'immediate'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
        isImmediate
          ? 'bg-negative-bg text-negative-text'
          : 'bg-bone border border-border/60 text-mid-gray'
      }`}
    >
      {isImmediate ? 'Inmediato' : 'Espera'}
    </span>
  )
}

function NotesCell({ t }: { t: Transaction }) {
  const hasSource = !!t.sourceDocument?.driveWebViewLink
  const hasProof = !!t.paymentProof?.driveWebViewLink
  const hasNote = !!t.notes?.trim()

  if (!hasNote && !hasSource && !hasProof) {
    return <span className="text-mid-gray/60">+ nota</span>
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {hasSource && (
        <a
          href={t.sourceDocument!.driveWebViewLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-5 h-5 rounded text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0"
          title={t.documentKind === 'purchase' ? 'Ver compra en Drive' : 'Ver factura en Drive'}
        >
          <FileText size={12} strokeWidth={1.5} />
        </a>
      )}
      {hasProof && (
        <a
          href={t.paymentProof!.driveWebViewLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-5 h-5 rounded text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0"
          title="Ver comprobante de pago"
        >
          <Receipt size={12} strokeWidth={1.5} />
        </a>
      )}
      {hasNote ? (
        <span className="truncate text-graphite">{t.notes}</span>
      ) : (
        <span className="text-mid-gray/60 truncate">—</span>
      )}
    </div>
  )
}

export function TransactionList() {
  const navigate = useNavigate()
  const { data: transactions, loading, loadingMore, hasMore, totalCount, loadMore, refetch } = usePaginatedTransactions()
  useRecurringGenerator()
  const { startDate, endDate } = useDateRange()
  const { categories: categoryItems } = useSettings()
  const { can } = usePermissions()
  const canEdit = can('finance', 'create')
  const inlineAgent = useInlineAgent()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [docDialogOpen, setDocDialogOpen] = useState(false)
  const [docDialogKind, setDocDialogKind] = useState<DocumentKind>('invoice')
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  // Solo facturas/compras: la vista "Facturación" trabaja con documentos
  // (invoice = cuenta por pagar a crédito, purchase = compra al contado).
  // Cualquier transacción sin documentKind (recurrentes, cierres) vive en
  // otras vistas (Flujo de Caja, Estado de Resultados).
  const invoiceTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.documentKind === 'invoice' || t.documentKind === 'purchase',
    )
  }, [transactions])

  // Pendientes: SIN filtro de rango. Las facturas pendientes son arrastres
  // de deuda real — si quedó algo sin pagar en marzo, debe seguir visible
  // aunque estés viendo mayo. Sirve tanto para el tab como para el dropdown
  // de PaymentUploadDialog (cruzar pago contra factura vieja).
  const pendingInvoicesAll = useMemo(() => {
    return invoiceTransactions.filter(
      (t) => (t.status === 'pending' || t.status === 'overdue') && t.documentKind === 'invoice',
    )
  }, [invoiceTransactions])

  // Pagadas dentro del rango — por fecha de pago (paidDate), fallback a la
  // de emisión si no existe paidDate (data legacy). "Pagadas en mayo" =
  // se pagaron en mayo, no que se emitieron en mayo.
  const paidInRange = useMemo(() => {
    return invoiceTransactions.filter((t) => {
      if (t.status !== 'paid') return false
      const ref = (t.paidDate ?? t.date)?.toDate?.()
      return ref ? ref >= startDate && ref <= endDate : true
    })
  }, [invoiceTransactions, startDate.getTime(), endDate.getTime()])

  const pendingCount = pendingInvoicesAll.length
  const paidCount = paidInRange.length

  const categories = useMemo(() => {
    const set = new Set(invoiceTransactions.map((t) => t.category).filter(Boolean))
    return Array.from(set).sort()
  }, [invoiceTransactions])

  const filtered = useMemo(() => {
    const source = activeTab === 'pending' ? pendingInvoicesAll : paidInRange
    return source.filter((t) => {
      const matchesSearch =
        search === '' ||
        t.concept.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        (t.payeeRef?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.docNumber ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        categoryFilter === '' || t.category === categoryFilter || t.category.startsWith(categoryFilter + ' > ')
      const matchesType = typeFilter === '' || t.type === typeFilter
      const effectivePriority = t.priority ?? 'waiting'
      const matchesPriority = priorityFilter === '' || effectivePriority === priorityFilter
      return matchesSearch && matchesCategory && matchesType && matchesPriority
    })
  }, [pendingInvoicesAll, paidInRange, activeTab, search, categoryFilter, typeFilter, priorityFilter])

  const handleRowClick = useCallback((t: Transaction) => {
    setEditingId(t.id)
    setFormOpen(true)
  }, [])

  // Snapshot que se inyecta al system prompt cuando el usuario abre el
  // asistente desde esta vista. Mantenerlo compacto (<1KB stringificado).
  const handleOpenAgent = useCallback(() => {
    const totalAmount = filtered.reduce((sum, t) => sum + t.amount, 0)
    const categoryCount = new Map<string, number>()
    for (const t of filtered) {
      const key = t.category || 'Sin categoría'
      categoryCount.set(key, (categoryCount.get(key) ?? 0) + 1)
    }
    const topCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))

    inlineAgent.openWith({
      module: 'finanzas',
      view: 'facturacion',
      activeTab,
      activeFilters: {
        search: search || null,
        category: categoryFilter || null,
        type: typeFilter || null,
        priority: priorityFilter || null,
      },
      visibleCount: filtered.length,
      totalAmount,
      dateRange: {
        from: startDate.toISOString().slice(0, 10),
        to: endDate.toISOString().slice(0, 10),
      },
      topCategories,
    })
  }, [filtered, activeTab, search, categoryFilter, typeFilter, priorityFilter, startDate, endDate, inlineAgent])

  const columns = useMemo<Column<Transaction>[]>(() => [
    {
      key: 'payee',
      header: 'Proveedor',
      width: '1.5fr',
      render: (t) => (
        <span className="font-medium text-dark-graphite truncate">
          {t.payeeRef?.name || '—'}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Categoría',
      width: '1.4fr',
      hideOnMobile: true,
      render: (t) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: getCategoryColor(t.category, categoryItems) }}
          />
          <span className="truncate">{t.category || '—'}</span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Prioridad',
      width: '0.9fr',
      hideOnMobile: true,
      render: (t) => <PriorityPill priority={t.priority} />,
    },
    {
      key: 'docKind',
      header: 'Tipo',
      width: '0.7fr',
      hideOnMobile: true,
      render: (t) => (
        <span className="text-mid-gray">
          {t.documentKind === 'invoice' ? 'Factura' : 'Compra'}
        </span>
      ),
    },
    {
      key: 'docNumber',
      header: 'Número',
      width: '0.9fr',
      hideOnMobile: true,
      render: (t) => (
        <span className="tabular-nums text-mid-gray">{t.docNumber || '—'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      width: '0.9fr',
      render: (t) => <span className="text-mid-gray">{formatDate(t.date)}</span>,
    },
    {
      key: 'amount',
      header: 'Valor',
      width: '1fr',
      primary: true,
      render: (t) => (
        <span className="font-medium text-graphite tabular-nums">
          {formatCurrency(t.amount, 0)}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Notas',
      width: '1.4fr',
      hideOnMobile: true,
      render: (t) => <NotesCell t={t} />,
    },
  ], [categoryItems])

  return (
    <PageTransition>
      <PageHeader title="Facturación">
        <DateRangePicker />
        <button
          onClick={handleOpenAgent}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
        >
          <Sparkles size={15} strokeWidth={1.5} />
          Asistente
        </button>
        {canEdit && (
          <>
            <button
              onClick={() => { setDocDialogKind('invoice'); setDocDialogOpen(true) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200"
            >
              <FileText size={15} strokeWidth={1.5} />
              Subir documento
            </button>
            <button
              onClick={() => setPaymentDialogOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              <Receipt size={15} strokeWidth={1.5} />
              Subir pago
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

      <InvoicesSummary pending={pendingInvoicesAll} paid={paidInRange} />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        {/* Tabs Pendientes / Pagadas */}
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-bone/60 border border-border/60 self-start">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-md text-body font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-surface text-graphite card-elevated'
                : 'text-mid-gray hover:text-graphite'
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`px-3 py-1.5 rounded-md text-body font-medium transition-colors ${
              activeTab === 'paid'
                ? 'bg-surface text-graphite card-elevated'
                : 'text-mid-gray hover:text-graphite'
            }`}
          >
            Pagadas ({paidCount})
          </button>
        </div>

        <div className="flex gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0 sm:min-w-[180px]">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar proveedor, número, categoría..." />
          </div>
          <FilterPopover
            activeCount={[categoryFilter, typeFilter, priorityFilter].filter(Boolean).length}
            onClear={() => {
              setCategoryFilter('')
              setTypeFilter('')
              setPriorityFilter('')
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
              <label className="block text-caption text-mid-gray mb-1">Tipo de documento</label>
              <SelectInput
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="Todos"
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'expense', label: 'Gasto' },
                  { value: 'income', label: 'Ingreso' },
                ]}
              />
            </div>
            <div>
              <label className="block text-caption text-mid-gray mb-1">Prioridad</label>
              <SelectInput
                value={priorityFilter}
                onChange={setPriorityFilter}
                placeholder="Todas"
                options={[
                  { value: '', label: 'Todas' },
                  { value: 'immediate', label: 'Inmediato' },
                  { value: 'waiting', label: 'Espera' },
                ]}
              />
            </div>
          </FilterPopover>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={activeTab === 'pending' ? 'No hay facturas pendientes' : 'No hay facturas pagadas'}
          description={
            activeTab === 'pending'
              ? 'Sube una factura nueva o registra una compra para empezar.'
              : 'Las facturas y compras pagadas aparecerán aquí.'
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={handleRowClick}
          />
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

      <DocumentUploadDialog
        open={docDialogOpen}
        onClose={() => setDocDialogOpen(false)}
        onSaved={() => refetch()}
        defaultKind={docDialogKind}
      />

      <PaymentUploadDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        onSaved={() => refetch()}
        pendingInvoices={pendingInvoicesAll}
      />

      <InlineAgentSheet
        open={inlineAgent.open}
        onOpenChange={inlineAgent.setOpen}
        contextSnapshot={inlineAgent.contextSnapshot}
        module="Facturación"
      />
    </PageTransition>
  )
}
