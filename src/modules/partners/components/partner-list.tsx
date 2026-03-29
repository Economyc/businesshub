import { useState, useMemo } from 'react'
import { Plus, Handshake } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { formatCurrency } from '@/core/utils/format'
import { usePartners } from '../hooks'
import { PartnerForm } from './partner-form'
import type { Partner } from '../types'

export function PartnerList() {
  const { data: partners, loading, refetch } = usePartners()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      const matchesSearch =
        search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.identification ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.email ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === '' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [partners, search, statusFilter])

  const totalInvestment = useMemo(() => {
    return filtered.reduce((sum, p) => sum + (p.investment ?? 0), 0)
  }, [filtered])

  const totalOwnership = useMemo(() => {
    return filtered.reduce((sum, p) => sum + (p.ownership ?? 0), 0)
  }, [filtered])

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      width: '2fr',
      render: (p: Partner) => <span className="font-medium text-dark-graphite">{p.name}</span>,
    },
    {
      key: 'identification',
      header: 'Identificación',
      width: '1fr',
      render: (p: Partner) => p.identification || '—',
    },
    {
      key: 'email',
      header: 'Email',
      width: '1.5fr',
      render: (p: Partner) => p.email || '—',
    },
    {
      key: 'ownership',
      header: 'Participación',
      width: '1fr',
      render: (p: Partner) => `${p.ownership ?? 0}%`,
    },
    {
      key: 'investment',
      header: 'Inversión',
      width: '1fr',
      render: (p: Partner) => formatCurrency(p.investment ?? 0),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (p: Partner) => <StatusBadge variant={p.status} />,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Socios">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        >
          <Plus size={15} strokeWidth={2} />
          Nuevo
        </button>
      </PageHeader>

      <PartnerForm
        open={showForm || !!editingPartner}
        partner={editingPartner}
        onClose={() => { setShowForm(false); setEditingPartner(null); refetch() }}
      />

      <div className="flex gap-4 mb-4 text-caption text-mid-gray">
        <span>
          Inversión total:{' '}
          <span className="font-medium text-graphite">{formatCurrency(totalInvestment)}</span>
        </span>
        <span>
          Participación total:{' '}
          <span className="font-medium text-graphite">{totalOwnership.toFixed(2)}%</span>
        </span>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar socio..." />
        </div>
        <FilterPopover
          activeCount={[statusFilter].filter(Boolean).length}
          onClear={() => setStatusFilter('')}
        >
          <div>
            <label className="block text-caption text-mid-gray mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No hay socios"
          description="Agrega tu primer socio usando el botón + Nuevo"
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(p) => setEditingPartner(p)}
        />
      )}
    </PageTransition>
  )
}
