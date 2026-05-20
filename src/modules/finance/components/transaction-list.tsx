import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Sparkles, FileText, Receipt, Files, StickyNote, Split, Plus, ShoppingBag, Users } from 'lucide-react'
import { TransactionForm } from './transaction-form'
import { DocumentUploadDialog } from './document-upload-dialog'
import { PaymentUploadDialog } from './payment-upload-dialog'
import { SplitExpenseDialog } from './split-expense-dialog'
import { ActionMenu } from '@/core/ui/action-menu'
import { InvoiceExportMenu } from './invoice-export-menu'
import type { DocumentKind, Transaction } from '../types'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { SelectInput } from '@/core/ui/select-input'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { DataTable, type Column } from '@/core/ui/data-table'
import { formatCurrency } from '@/core/utils/format'
import { parseCategory } from '@/core/utils/categories'
import { useSettings } from '@/core/hooks/use-settings'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useCompany } from '@/core/hooks/use-company'
import { useSuppliers } from '@/modules/suppliers/hooks'
import { formatDate } from '../utils/accounting-export'
import { useInvoicesPending, useInvoicesAndPurchasesPaid, useRecurringGenerator } from '../hooks'
import { useDateRange } from '../context/date-range-context'
import { InvoicesSummary } from './invoices-summary'

import { DateRangePicker } from './date-range-picker'
import type { CategoryItem } from '@/core/types/categories'
import { useInlineAgent } from '@/modules/agent/hooks/use-inline-agent'
import { InlineAgentSheet } from '@/modules/agent/components/inline-agent-sheet'
import { HoverHint } from '@/components/ui/tooltip'

type TabKey = 'pending' | 'paid'

// Mismo orden que MESES_ES del backend (functions/utils/doc-naming) para que el
// mes del nombre del archivo coincida con la carpeta del mes en Drive.
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

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
  const hasCombined = !!t.combinedDocument?.driveWebViewLink
  const hasNote = !!t.notes?.trim()

  if (!hasNote && !hasSource && !hasProof && !hasCombined) {
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
      {hasCombined && (
        <a
          href={t.combinedDocument!.driveWebViewLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-5 h-5 rounded text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0"
          title="Ver PDF combinado (factura + comprobante)"
        >
          <Files size={12} strokeWidth={1.5} />
        </a>
      )}
      {hasNote && (
        <HoverHint label={t.notes} side="top">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0 cursor-default">
            <StickyNote size={12} strokeWidth={1.5} />
          </span>
        </HoverHint>
      )}
    </div>
  )
}

export function TransactionList() {
  const navigate = useNavigate()
  const { data: pendingInvoicesAll, loading: loadingPending, refetch: refetchPending } = useInvoicesPending()
  const { data: paidAll, loading: loadingPaid, refetch: refetchPaid } = useInvoicesAndPurchasesPaid()
  const loading = loadingPending || loadingPaid
  const refetch = useCallback(() => { refetchPending(); refetchPaid() }, [refetchPending, refetchPaid])
  useRecurringGenerator()
  const { startDate, endDate } = useDateRange()
  const { categories: categoryItems } = useSettings()
  const { can } = usePermissions()
  const canEdit = can('finance', 'create')
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''
  const { data: suppliers } = useSuppliers()
  // Map proveedor → NIT para la columna NIT de la hoja contable. Vacío si el
  // proveedor aún no tiene identification cargada.
  const suppliersById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of suppliers) if (s.id) m.set(s.id, s.identification ?? '')
    return m
  }, [suppliers])
  const exportPeriod = useMemo(
    () => ({
      year: startDate.getFullYear(),
      monthIndex: startDate.getMonth(),
      monthLabel: MESES_ES[startDate.getMonth()],
    }),
    [startDate],
  )
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
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)

  // Pagadas dentro del rango — por fecha de pago (paidDate), fallback a la
  // de emisión si no existe paidDate (data legacy). "Pagadas en mayo" =
  // se pagaron en mayo, no que se emitieron en mayo.
  const paidInRange = useMemo(() => {
    return paidAll.filter((t) => {
      const ref = (t.paidDate ?? t.date)?.toDate?.()
      return ref ? ref >= startDate && ref <= endDate : true
    })
  }, [paidAll, startDate.getTime(), endDate.getTime()])

  const pendingCount = pendingInvoicesAll.length
  const paidCount = paidInRange.length

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const t of pendingInvoicesAll) if (t.category) set.add(t.category)
    for (const t of paidAll) if (t.category) set.add(t.category)
    return Array.from(set).sort()
  }, [pendingInvoicesAll, paidAll])

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
      width: '1fr',
      hideOnMobile: true,
      render: (t) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: getCategoryColor(t.category, categoryItems) }}
          />
          <span className="truncate">{parseCategory(t.category).category || '—'}</span>
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
      width: '0.9fr',
      hideOnMobile: true,
      render: (t) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-mid-gray">
            {t.documentKind === 'invoice' ? 'Factura' : 'Compra'}
          </span>
          {t.splitGroupId && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-bone border border-border/60 text-mid-gray shrink-0">
              Compartido
            </span>
          )}
        </div>
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
      width: '0.7fr',
      hideOnMobile: true,
      render: (t) => <NotesCell t={t} />,
    },
  ], [categoryItems])

  return (
    <PageTransition>
      <PageHeader title="Facturación">
        <DateRangePicker />
        <InvoiceExportMenu
          pending={pendingInvoicesAll}
          paid={paidInRange}
          suppliersById={suppliersById}
          companyId={companyId}
          period={exportPeriod}
        />
        <button
          onClick={handleOpenAgent}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
        >
          <Sparkles size={15} strokeWidth={1.5} />
          Asistente
        </button>
        {canEdit && (
          <ActionMenu
            label="Nuevo"
            icon={Plus}
            items={[
              { label: 'Factura / cuenta de cobro', icon: FileText, onClick: () => { setDocDialogKind('invoice'); setDocDialogOpen(true) } },
              { label: 'Compra (al contado)', icon: ShoppingBag, onClick: () => { setDocDialogKind('purchase'); setDocDialogOpen(true) } },
              { label: 'Comprobante de pago', icon: Receipt, onClick: () => setPaymentDialogOpen(true) },
              { label: 'Gasto compartido entre locales', icon: Split, onClick: () => setSplitDialogOpen(true) },
              { separator: true },
              { label: 'Nómina y Propinas', icon: Users, onClick: () => navigate('/finance/nomina') },
              { separator: true },
              { label: 'Importar desde archivo', icon: Upload, onClick: () => navigate('/finance/import') },
            ]}
          />
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
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={handleRowClick}
        />
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

      <SplitExpenseDialog
        open={splitDialogOpen}
        onClose={() => setSplitDialogOpen(false)}
        onSaved={() => refetch()}
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
