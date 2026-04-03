import { useState, useMemo } from 'react'
import { Plus, Package, Pencil, Trash2 } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { FilterPopover } from '@/core/ui/filter-popover'
import { DataTable } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { formatCurrency } from '@/core/utils/format'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { useProducts } from '../hooks'
import { productService } from '../services'
import { FinanceTabs } from '@/modules/finance/components/finance-tabs'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { ProductForm } from './product-form'
import type { Product } from '../types'

export function ProductList() {
  const { data: products, loading } = useProducts()

  const deleteMutation = useFirestoreMutation(
    'products',
    (companyId, id: string) => productService.remove(companyId, id),
    { optimisticDelete: true },
  )
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean))
    return Array.from(set).sort()
  }, [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === '' || p.category === categoryFilter
      const matchesStatus = statusFilter === '' ||
        (statusFilter === 'active' && p.active) ||
        (statusFilter === 'inactive' && !p.active)
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [products, search, categoryFilter, statusFilter])

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      width: '2fr',
      render: (p: Product) => <span className="font-medium text-dark-graphite">{p.name}</span>,
    },
    {
      key: 'category',
      header: 'Categoría',
      width: '1fr',
      render: (p: Product) => p.category,
    },
    {
      key: 'unit',
      header: 'Unidad',
      width: '0.6fr',
      render: (p: Product) => p.unit,
    },
    {
      key: 'referencePrice',
      header: 'Precio Ref.',
      width: '1fr',
      render: (p: Product) => formatCurrency(p.referencePrice),
    },
    {
      key: 'perishable',
      header: 'Perecedero',
      width: '0.7fr',
      render: (p: Product) => p.perishable ? 'Sí' : 'No',
    },
    {
      key: 'active',
      header: 'Estado',
      width: '0.7fr',
      render: (p: Product) => <StatusBadge variant={p.active ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (p: Product) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(p) }}
            className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
            title="Editar"
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeletingProduct(p) }}
            className="p-1.5 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      ),
    },
  ]

  function handleEdit(p: Product) {
    setEditingProduct(p)
    setShowForm(true)
  }

  function handleRowClick(p: Product) {
    handleEdit(p)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingProduct(null)
  }

  async function handleDeleteConfirm() {
    if (!deletingProduct) return
    await deleteMutation.mutateAsync(deletingProduct.id)
    setDeletingProduct(null)
  }

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <DateRangePicker />
        <button
          onClick={() => { setEditingProduct(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        >
          <Plus size={15} strokeWidth={2} />
          Nuevo
        </button>
      </PageHeader>
      <FinanceTabs />

      <ProductForm open={showForm} onClose={handleCloseForm} product={editingProduct} />

      <ConfirmDialog
        open={!!deletingProduct}
        title="Eliminar insumo"
        description={`¿Estás seguro de eliminar "${deletingProduct?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingProduct(null)}
      />

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar insumo..." />
        </div>
        <FilterPopover
          activeCount={[categoryFilter, statusFilter].filter(Boolean).length}
          onClear={() => { setCategoryFilter(''); setStatusFilter('') }}
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
                <option key={c} value={c}>{c}</option>
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
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </FilterPopover>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No hay insumos"
          description="Agrega tu primer insumo usando el botón + Nuevo"
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={handleRowClick}
        />
      )}
    </PageTransition>
  )
}
