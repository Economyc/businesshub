import { useState, useMemo } from 'react'
import { Plus, Package, SquarePen, Trash2 } from 'lucide-react'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { formatCurrency } from '@/core/utils/format'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useCompany } from '@/core/hooks/use-company'
import { useInventoryItems, useInventoryItemMutations } from '../hooks/use-inventory-items'
import { ItemForm } from './item-form'
import type { InventoryItem } from '../types'

function StateChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${
        active ? 'bg-positive-bg text-positive-text' : 'bg-smoke text-mid-gray'
      }`}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}

export function ItemsTab() {
  const { selectedCompany } = useCompany()
  const { can } = usePermissions()
  const canCreate = can('inventory', 'create')
  const canUpdate = can('inventory', 'update')
  const canDelete = can('inventory', 'delete')

  const { data: items, loading } = useInventoryItems()
  const { remove } = useInventoryItemMutations()

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [toDelete, setToDelete] = useState<InventoryItem | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    if (!q) return sorted
    return sorted.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q),
    )
  }, [items, search])

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(item: InventoryItem) {
    if (!canUpdate) return
    setEditing(item)
    setShowForm(true)
  }

  async function confirmDelete() {
    if (!toDelete || !selectedCompany) return
    await remove.mutateAsync(toDelete.id)
    setToDelete(null)
  }

  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Insumo',
      width: '2fr',
      primary: true,
      render: (i) => <span className="font-medium text-dark-graphite">{i.name}</span>,
    },
    { key: 'category', header: 'Categoría', width: '1fr', render: (i) => i.category || '—' },
    { key: 'stockUnit', header: 'U. stock', width: '0.7fr', render: (i) => i.stockUnit },
    {
      key: 'purchase',
      header: 'Compra',
      width: '1.2fr',
      render: (i) => (
        <span>
          {i.purchaseUnit || '—'}
          {i.purchaseToStockFactor ? <span className="text-mid-gray"> · ×{i.purchaseToStockFactor.toLocaleString('es-CO')}</span> : null}
        </span>
      ),
    },
    {
      key: 'unitCost',
      header: 'Costo',
      width: '1fr',
      render: (i) => (i.unitCost != null ? formatCurrency(i.unitCost) : '—'),
    },
    {
      key: 'parLevel',
      header: 'Par',
      width: '0.8fr',
      render: (i) => (i.parLevel != null ? `${i.parLevel.toLocaleString('es-CO')} ${i.stockUnit}` : '—'),
    },
    { key: 'state', header: 'Estado', width: '0.8fr', render: (i) => <StateChip active={i.active !== false} /> },
    {
      key: 'actions',
      header: '',
      width: '88px',
      hideOnMobile: true,
      render: (i) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(i) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-bone hover:text-graphite transition-colors"
              aria-label="Editar"
            >
              <SquarePen size={15} strokeWidth={1.5} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setToDelete(i) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-negative-bg hover:text-negative-text transition-colors"
              aria-label="Eliminar"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar insumo o categoría..." />
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            Nuevo insumo
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={items.length === 0 ? 'Aún no hay insumos' : 'Sin resultados'}
          description={
            items.length === 0
              ? 'Crea tu primer insumo con el botón "Nuevo insumo".'
              : 'Ningún insumo coincide con la búsqueda.'
          }
        />
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={canUpdate ? openEdit : undefined} />
      )}

      <ItemForm open={showForm} onClose={() => setShowForm(false)} item={editing} />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar insumo"
        description={toDelete ? `¿Eliminar "${toDelete.name}"? Esta acción no se puede deshacer.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
