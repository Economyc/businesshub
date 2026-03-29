import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileSignature } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { useContracts } from '../hooks'
import { ContractsTabs } from './contracts-tabs'
import type { Contract } from '../types'
import type { Timestamp } from 'firebase/firestore'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  indefinido: 'Indefinido',
  fijo: 'Fijo',
  obra_labor: 'Obra/Labor',
  aprendizaje: 'Aprendizaje',
  prestacion_servicios: 'Prestación',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  terminated: 'Terminado',
  expired: 'Vencido',
}

function formatDate(ts: Timestamp | string | undefined): string {
  if (!ts) return '—'
  try {
    const date = typeof ts === 'string' ? new Date(ts)
      : typeof ts === 'object' && 'toDate' in ts ? ts.toDate()
      : typeof ts === 'object' && 'seconds' in (ts as Record<string, unknown>) ? new Date((ts as unknown as { seconds: number }).seconds * 1000)
      : null
    if (!date || isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch { return '—' }
}

export function ContractList() {
  const navigate = useNavigate()
  const { data: contracts, loading } = useContracts()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      const matchesSearch =
        search === '' ||
        c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
        c.employeeIdentification?.toLowerCase().includes(search.toLowerCase()) ||
        c.position.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === '' || c.status === statusFilter
      const matchesType = typeFilter === '' || c.contractType === typeFilter
      return matchesSearch && matchesStatus && matchesType
    })
  }, [contracts, search, statusFilter, typeFilter])

  const columns = [
    {
      key: 'employeeName',
      header: 'Empleado',
      width: '2fr',
      render: (c: Contract) => (
        <div>
          <span className="font-medium text-dark-graphite">{c.employeeName}</span>
          <div className="text-caption text-mid-gray">{c.employeeIdentification}</div>
        </div>
      ),
    },
    {
      key: 'position',
      header: 'Cargo',
      width: '1.5fr',
      render: (c: Contract) => c.position,
    },
    {
      key: 'contractType',
      header: 'Tipo',
      width: '1fr',
      render: (c: Contract) => CONTRACT_TYPE_LABELS[c.contractType] ?? c.contractType,
    },
    {
      key: 'salary',
      header: 'Salario',
      width: '1fr',
      render: (c: Contract) => formatCurrency(c.salary),
    },
    {
      key: 'startDate',
      header: 'Inicio',
      width: '1fr',
      render: (c: Contract) => formatDate(c.startDate),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (c: Contract) => (
        <StatusBadge variant={c.status === 'active' ? 'active' : c.status === 'draft' ? 'pending' : 'inactive'} label={STATUS_LABELS[c.status] ?? c.status} />
      ),
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Contratos">
        <button
          onClick={() => navigate('/contracts/new')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        >
          <Plus size={15} strokeWidth={2} />
          Generar Contrato
        </button>
      </PageHeader>

      <ContractsTabs />

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar contrato..." />
        </div>
        <FilterPopover
          activeCount={[statusFilter, typeFilter].filter(Boolean).length}
          onClear={() => { setStatusFilter(''); setTypeFilter('') }}
        >
          <div>
            <label className="block text-caption text-mid-gray mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-caption text-mid-gray mb-1">Tipo de contrato</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No hay contratos"
          description="Genera tu primer contrato usando el botón + Generar Contrato"
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(c) => navigate(`/contracts/${c.id}`)}
        />
      )}
    </PageTransition>
  )
}
