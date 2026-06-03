import { useState, useMemo } from 'react'
import { Plus, ClipboardCheck, SquarePen, Trash2 } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { formatCurrency } from '@/core/utils/format'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useInventoryItems } from '../hooks/use-inventory-items'
import { useCounts, useCountMutations } from '../hooks/use-counts'
import { costPerStockUnit } from '../domain/units'
import { CountForm } from './count-form'
import type { InventoryCount, InventoryItem } from '../types'

function StatusChip({ status }: { status: 'draft' | 'final' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${
        status === 'final' ? 'bg-positive-bg text-positive-text' : 'bg-warning-bg text-warning-text'
      }`}
    >
      {status === 'final' ? 'Final' : 'Borrador'}
    </span>
  )
}

export function CountTab() {
  const { can } = usePermissions()
  const canCreate = can('inventory', 'create')
  const canUpdate = can('inventory', 'update')
  const canDelete = can('inventory', 'delete')

  const { data: counts, loading } = useCounts()
  const { data: items } = useInventoryItems()
  const { remove } = useCountMutations()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InventoryCount | null>(null)
  const [toDelete, setToDelete] = useState<InventoryCount | null>(null)

  const itemsById = useMemo(() => {
    const map: Record<string, InventoryItem> = {}
    for (const it of items) map[it.id] = it
    return map
  }, [items])

  const sorted = useMemo(
    () => [...counts].sort((a, b) => b.countedAt.toMillis() - a.countedAt.toMillis()),
    [counts],
  )

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(count: InventoryCount) {
    if (!canUpdate) return
    setEditing(count)
    setShowForm(true)
  }

  async function confirmDelete() {
    if (!toDelete) return
    await remove.mutateAsync(toDelete.id)
    setToDelete(null)
  }

  /** Costo total del conteo = Σ qty·costPerStockUnit. null si falta algún costo. */
  function countTotal(count: InventoryCount): number | null {
    let total = 0
    for (const line of count.lines) {
      const item = itemsById[line.itemId]
      if (!item) continue
      const perUnit = costPerStockUnit(item.unitCost ?? 0, item.purchaseToStockFactor)
      if (perUnit <= 0) return null
      total += line.qty * perUnit
    }
    return total
  }

  const columns: Column<InventoryCount>[] = [
    {
      key: 'date',
      header: 'Fecha',
      width: '1.6fr',
      primary: true,
      render: (c) => (
        <div className="min-w-0">
          <div className="font-medium text-dark-graphite">
            {c.countedAt.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          {c.countedBy && <div className="text-caption text-mid-gray truncate">{c.countedBy}</div>}
        </div>
      ),
    },
    { key: 'lines', header: 'Insumos', width: '1fr', render: (c) => `${c.lines.length}` },
    { key: 'status', header: 'Estado', width: '1fr', render: (c) => <StatusChip status={c.status} /> },
    {
      key: 'total',
      header: 'Valor inventario',
      width: '1.2fr',
      render: (c) => {
        const total = countTotal(c)
        return total != null ? formatCurrency(total) : <span className="text-mid-gray">—</span>
      },
    },
    {
      key: 'actions',
      header: '',
      width: '88px',
      hideOnMobile: true,
      render: (c) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(c) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-bone hover:text-graphite transition-colors"
              aria-label="Editar"
            >
              <SquarePen size={15} strokeWidth={1.5} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setToDelete(c) }}
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
        <p className="flex-1 text-body text-mid-gray">
          Cada conteo final ancla el cálculo de stock: el stock proyectado parte del último conteo y descuenta el consumo de las ventas.
        </p>
        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            Nuevo conteo
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Aún no hay conteos"
          description='Crea el primer conteo físico con el botón "Nuevo conteo" para anclar el cálculo de stock.'
        />
      ) : (
        <DataTable columns={columns} data={sorted} onRowClick={canUpdate ? openEdit : undefined} />
      )}

      <CountForm open={showForm} onClose={() => setShowForm(false)} count={editing} />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar conteo"
        description={
          toDelete
            ? `¿Eliminar el conteo del ${toDelete.countedAt.toDate().toLocaleDateString('es-CO')}? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
