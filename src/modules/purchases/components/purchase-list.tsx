import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ShoppingCart } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { LoadMoreButton } from '@/core/ui/load-more-button'
import { formatCurrency } from '@/core/utils/format'
import { usePermissions } from '@/core/hooks/use-permissions'
import { usePaginatedPurchases } from '../hooks'

import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import type { Purchase, PurchaseStatus, PaymentStatus } from '../types'

const STATUS_MAP: Record<PurchaseStatus, string> = {
  received: 'active',
  partial: 'pending',
  pending: 'pending',
}

const PAYMENT_MAP: Record<PaymentStatus, string> = {
  paid: 'paid',
  pending: 'pending',
  overdue: 'overdue',
}

function formatDate(ts: any): string {
  const d = ts?.toDate?.()
  if (!d) return '—'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  received: 'Recibido',
  partial: 'Parcial',
  pending: 'Pendiente',
}

export function PurchaseList() {
  const navigate = useNavigate()
  const { data: purchases, loading, loadingMore, hasMore, totalCount, loadMore } = usePaginatedPurchases()
  const { can } = usePermissions()
  const canEdit = can('finance', 'create')
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')

  const suppliers = useMemo(() => {
    const set = new Set(purchases.map((p) => p.supplierName).filter(Boolean))
    return Array.from(set).sort()
  }, [purchases])

  const sorted = useMemo(() => {
    return [...purchases].sort((a, b) => {
      const da = a.date?.toDate?.()?.getTime() ?? 0
      const db = b.date?.toDate?.()?.getTime() ?? 0
      return db - da
    })
  }, [purchases])

  const filtered = useMemo(() => {
    return sorted.filter((p) => {
      const matchesSearch =
        search === '' ||
        p.supplierName.toLowerCase().includes(search.toLowerCase()) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(search.toLowerCase()))
      const matchesSupplier = supplierFilter === '' || p.supplierName === supplierFilter
      const matchesStatus = statusFilter === '' || p.status === statusFilter
      const matchesPayment = paymentFilter === '' || p.paymentStatus === paymentFilter
      return matchesSearch && matchesSupplier && matchesStatus && matchesPayment
    })
  }, [sorted, search, supplierFilter, statusFilter, paymentFilter])

  const columns = [
    {
      key: 'date',
      header: 'Fecha',
      width: '1fr',
      render: (p: Purchase) => formatDate(p.date),
    },
    {
      key: 'supplierName',
      header: 'Proveedor',
      width: '1.5fr',
      render: (p: Purchase) => <span className="font-medium text-dark-graphite">{p.supplierName}</span>,
    },
    {
      key: 'invoiceNumber',
      header: '# Factura',
      width: '0.8fr',
      render: (p: Purchase) => p.invoiceNumber || '—',
    },
    {
      key: 'items',
      header: 'Items',
      width: '0.5fr',
      render: (p: Purchase) => p.items.length,
    },
    {
      key: 'total',
      header: 'Total',
      width: '1fr',
      render: (p: Purchase) => <span className="font-medium">{formatCurrency(p.total)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (p: Purchase) => (
        <StatusBadge variant={STATUS_MAP[p.status] as any} label={STATUS_LABELS[p.status]} />
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Pago',
      width: '0.8fr',
      render: (p: Purchase) => <StatusBadge variant={PAYMENT_MAP[p.paymentStatus] as any} />,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <DateRangePicker />
        {canEdit && (
          <button
            onClick={() => navigate('/finance/purchases/new')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
          >
            <Plus size={15} strokeWidth={2} />
            Nueva Compra
          </button>
        )}
      </PageHeader>
      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por proveedor o factura..." />
        </div>
        <FilterPopover
          activeCount={[supplierFilter, statusFilter, paymentFilter].filter(Boolean).length}
          onClear={() => { setSupplierFilter(''); setStatusFilter(''); setPaymentFilter('') }}
        >
          <div>
            <label className="block text-caption text-mid-gray mb-1">Proveedor</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-mid-gray mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos</option>
              <option value="received">Recibido</option>
              <option value="partial">Parcial</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>
          <div>
            <label className="block text-caption text-mid-gray mb-1">Pago</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos</option>
              <option value="paid">Pagado</option>
              <option value="pending">Pendiente</option>
              <option value="overdue">Vencido</option>
            </select>
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={7} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No hay compras"
          description="Registra tu primera compra usando el botón + Nueva Compra"
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(p) => navigate(`/finance/purchases/${p.id}`)}
          />
          <LoadMoreButton
            onClick={loadMore}
            loading={loadingMore}
            hasMore={hasMore}
            loadedCount={purchases.length}
            totalCount={totalCount}
          />
        </>
      )}
    </PageTransition>
  )
}
