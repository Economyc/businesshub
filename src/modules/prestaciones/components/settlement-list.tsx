import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Gift } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { formatCurrency } from '@/core/utils/format'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useSettlements } from '../hooks'
import { SettlementForm } from './settlement-form'
import { SETTLEMENT_STATUS_LABELS, SETTLEMENT_STATUS_COLORS, type SettlementRecord, type SettlementStatus } from '../types'

export function SettlementList() {
  const { data: settlements, loading, refetch } = useSettlements()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canEdit = can('prestaciones', 'create')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const sorted = useMemo(() => {
    const list = [...settlements].sort((a, b) => b.year - a.year)
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(
      (s) =>
        s.periodLabel.toLowerCase().includes(q) ||
        s.typeLabel.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q),
    )
  }, [settlements, search])

  const columns = [
    {
      key: 'periodLabel',
      header: 'Periodo',
      width: '1.5fr',
      render: (s: SettlementRecord) => (
        <span className="font-medium text-dark-graphite">{s.periodLabel}</span>
      ),
    },
    {
      key: 'typeLabel',
      header: 'Tipo',
      width: '1.2fr',
      render: (s: SettlementRecord) => s.typeLabel,
    },
    {
      key: 'employeeCount',
      header: 'Empleados',
      width: '0.8fr',
      render: (s: SettlementRecord) => s.employeeCount,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      width: '1fr',
      render: (s: SettlementRecord) => (
        <span className="font-medium">{formatCurrency(s.totalAmount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (s: SettlementRecord) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-caption font-medium border ${SETTLEMENT_STATUS_COLORS[s.status]}`}>
          {SETTLEMENT_STATUS_LABELS[s.status]}
        </span>
      ),
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Prestaciones Sociales">
        {canEdit && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
          >
            <Plus size={15} strokeWidth={2} />
            Nueva Liquidacion
          </button>
        )}
      </PageHeader>

      <SettlementForm
        open={showForm}
        onClose={() => { setShowForm(false); refetch() }}
      />

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por periodo o tipo..." />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No hay liquidaciones"
          description="Crea tu primera liquidacion de prestaciones sociales con el boton + Nueva Liquidacion"
        />
      ) : (
        <DataTable
          columns={columns}
          data={sorted}
          onRowClick={(s) => navigate(`/prestaciones/${s.id}`)}
        />
      )}
    </PageTransition>
  )
}
