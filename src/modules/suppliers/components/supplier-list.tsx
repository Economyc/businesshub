import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Briefcase } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { useSuppliers } from '../hooks'
import { SupplierForm } from './supplier-form'
import type { Supplier } from '../types'


export function SupplierList() {
  const navigate = useNavigate()
  const { data: suppliers, loading, refetch } = useSuppliers()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)

  const categories = useMemo(() => {
    const set = new Set(suppliers.map((s) => s.category).filter(Boolean))
    return Array.from(set).sort()
  }, [suppliers])

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      const matchesSearch =
        search === '' ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.identification && s.identification.toLowerCase().includes(search.toLowerCase())) ||
        s.contactName.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === '' || s.category === categoryFilter || s.category.startsWith(categoryFilter + ' > ')
      const matchesStatus = statusFilter === '' || s.status === statusFilter
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [suppliers, search, categoryFilter, statusFilter])

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      width: '2fr',
      render: (s: Supplier) => (
          <span className="font-medium text-dark-graphite">{s.name}</span>
      ),
    },
    {
      key: 'identification',
      header: 'Identificación',
      width: '1fr',
      render: (s: Supplier) => s.identification || '—',
    },
    {
      key: 'category',
      header: 'Categoría',
      width: '1fr',
      render: (s: Supplier) => s.category,
    },
    {
      key: 'contactName',
      header: 'Contacto',
      width: '1.5fr',
      render: (s: Supplier) => s.contactName,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '0.8fr',
      render: (s: Supplier) => <StatusBadge variant={s.status} />,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Central de Proveedores">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        >
          <Plus size={15} strokeWidth={2} />
          Nuevo
        </button>
      </PageHeader>

      <SupplierForm open={showForm} onClose={() => { setShowForm(false); refetch() }} />

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar proveedor..." />
        </div>
        <FilterPopover
          activeCount={[categoryFilter, statusFilter].filter(Boolean).length}
          onClear={() => {
            setCategoryFilter('')
            setStatusFilter('')
          }}
        >
          <div>
            <label className="block text-caption text-mid-gray mb-1">Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
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
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="expired">Vencido</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No hay proveedores"
          description="Agrega tu primer proveedor usando el botón + Nuevo"
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
        />
      )}
    </PageTransition>
  )
}
