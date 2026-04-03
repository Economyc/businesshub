import { useState, useMemo } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, DollarSign, AlertTriangle, Clock, Banknote } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { CarteraSkeleton } from '@/core/ui/skeleton'
import { useCarteraItems, useCarteraSummary } from '../hooks'
import { PaymentForm } from './payment-form'
import type { CarteraItem } from '../types'
import type { Column } from '@/core/ui/data-table'

type Tab = 'receivables' | 'payables'

const TABS = [
  { value: 'receivables', label: 'Cuentas por Cobrar', icon: ArrowDownCircle },
  { value: 'payables', label: 'Cuentas por Pagar', icon: ArrowUpCircle },
]

function StatusBadge({ status }: { status: CarteraItem['status'] }) {
  const config = {
    pending: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' },
    partial: { label: 'Parcial', className: 'bg-blue-50 text-blue-700' },
    paid: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700' },
    overdue: { label: 'Vencido', className: 'bg-red-50 text-red-700' },
  }
  const c = config[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}

function SummaryCard({ label, value, icon: Icon, negative }: {
  label: string
  value: number
  icon: typeof Wallet
  negative?: boolean
}) {
  return (
    <div className="bg-surface rounded-xl card-elevated p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-bone">
          <Icon size={15} strokeWidth={1.5} className="text-mid-gray" />
        </div>
        <span className="text-caption uppercase tracking-wider text-mid-gray">{label}</span>
      </div>
      <div className={`text-xl font-semibold ${negative ? 'text-negative-text' : 'text-dark-graphite'}`}>
        {formatCurrency(value)}
      </div>
    </div>
  )
}

function formatDate(ts: { toDate?: () => Date } | undefined): string {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function CarteraDashboard() {
  const { receivables, payables, loading } = useCarteraItems()
  const { summary } = useCarteraSummary()
  const [tab, setTab] = useState<Tab>('receivables')
  const [search, setSearch] = useState('')
  const [paymentTarget, setPaymentTarget] = useState<CarteraItem | null>(null)

  const items = tab === 'receivables' ? receivables : payables

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((i) =>
      i.concept.toLowerCase().includes(q) ||
      i.counterparty.toLowerCase().includes(q)
    )
  }, [items, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Overdue first, then by days outstanding desc
      if (a.status === 'overdue' && b.status !== 'overdue') return -1
      if (b.status === 'overdue' && a.status !== 'overdue') return 1
      return b.daysOutstanding - a.daysOutstanding
    })
  }, [filtered])

  function handleRefresh() {
    // The hooks auto-refresh via cache invalidation in services
    window.location.reload()
  }

  const columns: Column<CarteraItem>[] = [
    {
      key: 'concept',
      header: 'Concepto',
      width: '2fr',
      render: (item) => (
        <div className="min-w-0">
          <div className="font-medium text-dark-graphite truncate">{item.concept}</div>
          <div className="text-caption text-mid-gray truncate">{item.counterparty}</div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      width: '1fr',
      hideOnMobile: true,
      render: (item) => <span className="text-mid-gray">{formatDate(item.date)}</span>,
    },
    {
      key: 'original',
      header: 'Original',
      width: '1fr',
      hideOnMobile: true,
      render: (item) => <span className="text-graphite">{formatCurrency(item.originalAmount)}</span>,
    },
    {
      key: 'balance',
      header: 'Saldo',
      width: '1fr',
      primary: true,
      render: (item) => (
        <span className="font-semibold text-dark-graphite">{formatCurrency(item.balance)}</span>
      ),
    },
    {
      key: 'days',
      header: 'Días',
      width: '0.5fr',
      hideOnMobile: true,
      render: (item) => (
        <span className={item.daysOutstanding > 15 ? 'text-negative-text font-medium' : 'text-mid-gray'}>
          {item.daysOutstanding}d
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (item) => (
        <button
          onClick={(e) => { e.stopPropagation(); setPaymentTarget(item) }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-caption font-medium btn-primary hover:shadow-sm transition-all"
        >
          <Banknote size={13} strokeWidth={1.5} />
          {tab === 'receivables' ? 'Recibido' : 'Pagar'}
        </button>
      ),
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Cartera" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Por Cobrar" value={summary.totalReceivables} icon={ArrowDownCircle} />
        <SummaryCard label="Por Pagar" value={summary.totalPayables} icon={ArrowUpCircle} />
        <SummaryCard label="Posición Neta" value={summary.netPosition} icon={DollarSign} />
        <SummaryCard
          label="Vencido"
          value={summary.overdueTotal}
          icon={AlertTriangle}
          negative={summary.overdueTotal > 0}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <UnderlineButtonTabs
          tabs={TABS}
          active={tab}
          onChange={(v) => { setTab(v as Tab); setSearch('') }}
        />
        <div className="w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <CarteraSkeleton />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={tab === 'receivables' ? 'Sin cuentas por cobrar' : 'Sin cuentas por pagar'}
          description={search ? 'No se encontraron resultados' : 'No hay pagos pendientes'}
        />
      ) : (
        <>
          <DataTable columns={columns} data={sorted} />
          <div className="mt-3 text-caption text-mid-gray text-right">
            {sorted.length} {sorted.length === 1 ? 'registro' : 'registros'} — Total saldo: {formatCurrency(sorted.reduce((s, i) => s + i.balance, 0))}
          </div>
        </>
      )}

      {/* Payment modal */}
      {paymentTarget && (
        <PaymentForm
          item={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={handleRefresh}
        />
      )}
    </PageTransition>
  )
}
