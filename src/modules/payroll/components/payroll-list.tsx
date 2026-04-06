import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Receipt } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { formatCurrency } from '@/core/utils/format'
import { usePermissions } from '@/core/hooks/use-permissions'
import { usePayrolls } from '../hooks'
import { PayrollForm } from './payroll-form'
import type { PayrollRecord, PayrollStatus } from '../types'

const STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobada',
  paid: 'Pagada',
}

const STATUS_COLORS: Record<PayrollStatus, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function PayrollList() {
  const { data: payrolls, loading, refetch } = usePayrolls()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canEdit = can('payroll', 'create')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const sorted = useMemo(() => {
    const list = [...payrolls].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(
      (p) =>
        p.periodLabel.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q),
    )
  }, [payrolls, search])

  const columns = [
    {
      key: 'periodLabel',
      header: 'Periodo',
      width: '1.5fr',
      render: (p: PayrollRecord) => (
        <span className="font-medium text-dark-graphite">{p.periodLabel}</span>
      ),
    },
    {
      key: 'employeeCount',
      header: 'Empleados',
      width: '0.8fr',
      render: (p: PayrollRecord) => p.employeeCount,
    },
    {
      key: 'totalNetPay',
      header: 'Neto Total',
      width: '1fr',
      render: (p: PayrollRecord) => (
        <span className="font-medium">{formatCurrency(p.totalNetPay)}</span>
      ),
    },
    {
      key: 'totalDeductions',
      header: 'Deducciones',
      width: '1fr',
      render: (p: PayrollRecord) => (
        <span className="text-red-500">{formatCurrency(p.totalDeductions)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (p: PayrollRecord) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-caption font-medium border ${STATUS_COLORS[p.status]}`}>
          {STATUS_LABELS[p.status]}
        </span>
      ),
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Liquidacion de Nomina">
        {canEdit && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
          >
            <Plus size={15} strokeWidth={2} />
            Nueva Nomina
          </button>
        )}
      </PageHeader>

      <PayrollForm
        open={showForm}
        onClose={() => { setShowForm(false); refetch() }}
      />

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por periodo..." />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay nominas"
          description="Crea tu primera liquidacion de nomina con el boton + Nueva Nomina"
        />
      ) : (
        <DataTable
          columns={columns}
          data={sorted}
          onRowClick={(p) => navigate(`/payroll/${p.id}`)}
        />
      )}
    </PageTransition>
  )
}
