import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, DollarSign } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { useTransactions } from '../hooks'
import { FinanceSummary } from './finance-summary'
import type { Transaction } from '../types'

const selectClass =
  'px-3 py-2.5 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'

export function TransactionList() {
  const navigate = useNavigate()
  const { data: transactions, loading } = useTransactions()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const categories = useMemo(() => {
    const set = new Set(transactions.map((t) => t.category).filter(Boolean))
    return Array.from(set).sort()
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        search === '' || t.concept.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === '' || t.category === categoryFilter
      const matchesType = typeFilter === '' || t.type === typeFilter
      const matchesStatus = statusFilter === '' || t.status === statusFilter

      let matchesDate = true
      if (dateFrom || dateTo) {
        const txDate = t.date?.toDate?.() ?? new Date(0)
        if (dateFrom) matchesDate = matchesDate && txDate >= new Date(dateFrom)
        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999)
          matchesDate = matchesDate && txDate <= toDate
        }
      }

      return matchesSearch && matchesCategory && matchesType && matchesStatus && matchesDate
    })
  }, [transactions, search, categoryFilter, typeFilter, statusFilter, dateFrom, dateTo])

  const columns = [
    {
      key: 'concept',
      header: 'Concepto',
      width: '2fr',
      render: (t: Transaction) => <span className="font-medium text-dark-graphite">{t.concept}</span>,
    },
    {
      key: 'category',
      header: 'Categoría',
      width: '1fr',
      render: (t: Transaction) => t.category,
    },
    {
      key: 'amount',
      header: 'Monto',
      width: '1fr',
      render: (t: Transaction) => (
        <span className={t.type === 'income' ? 'text-positive-text' : ''}>
          ${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      width: '1fr',
      render: (t: Transaction) => {
        const d = t.date?.toDate?.()
        return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
      },
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (t: Transaction) => <StatusBadge variant={t.status} />,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <button
          onClick={() => navigate('/finance/new')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-graphite text-white text-[13px] font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        >
          <Plus size={15} strokeWidth={2} />
          Nueva
        </button>
        <button
          onClick={() => navigate('/finance/import')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-[13px] font-medium transition-all duration-200 hover:bg-bone"
        >
          <Upload size={15} strokeWidth={1.5} />
          Importar
        </button>
      </PageHeader>

      <FinanceSummary />

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar transacción..." />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClass}>
          <option value="">Todos</option>
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">Todos los estados</option>
          <option value="paid">Pagado</option>
          <option value="pending">Pendiente</option>
          <option value="overdue">Vencido</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="Desde"
          className={selectClass}
          title="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="Hasta"
          className={selectClass}
          title="Hasta"
        />
      </div>

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No hay transacciones"
          description="Registra tu primera transacción usando el botón + Nueva"
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </PageTransition>
  )
}
