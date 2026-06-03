import { useState, useMemo } from 'react'
import { Plus, Trash2, SquarePen } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useAdjustments, useAdjustmentMutations } from '../hooks/use-adjustments'
import { WasteForm } from './waste-form'
import type { InventoryAdjustment, AdjustmentType } from '../types'

const TYPE_LABEL: Record<AdjustmentType, string> = {
  merma: 'Merma',
  daño: 'Daño',
  cortesía: 'Cortesía',
  traslado: 'Traslado',
  corrección: 'Corrección',
}

function TypeChip({ type }: { type: AdjustmentType }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-warning-bg text-warning-text">
      {TYPE_LABEL[type] ?? type}
    </span>
  )
}

export function WasteTab() {
  const { can } = usePermissions()
  const canCreate = can('inventory', 'create')
  const canUpdate = can('inventory', 'update')
  const canDelete = can('inventory', 'delete')

  const { data: adjustments, loading } = useAdjustments()
  const { remove } = useAdjustmentMutations()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InventoryAdjustment | null>(null)
  const [toDelete, setToDelete] = useState<InventoryAdjustment | null>(null)

  const sorted = useMemo(
    () => [...adjustments].sort((a, b) => b.occurredAt.toMillis() - a.occurredAt.toMillis()),
    [adjustments],
  )

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(adjustment: InventoryAdjustment) {
    if (!canUpdate) return
    setEditing(adjustment)
    setShowForm(true)
  }

  async function confirmDelete() {
    if (!toDelete) return
    await remove.mutateAsync(toDelete.id)
    setToDelete(null)
  }

  const columns: Column<InventoryAdjustment>[] = [
    {
      key: 'date',
      header: 'Fecha',
      width: '1.6fr',
      primary: true,
      render: (a) => (
        <div className="min-w-0">
          <div className="font-medium text-dark-graphite">
            {a.occurredAt.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          {a.by && <div className="text-caption text-mid-gray truncate">{a.by}</div>}
        </div>
      ),
    },
    { key: 'type', header: 'Motivo', width: '1.2fr', render: (a) => <TypeChip type={a.type} /> },
    { key: 'lines', header: 'Insumos', width: '1fr', render: (a) => `${a.lines.length}` },
    {
      key: 'actions',
      header: '',
      width: '88px',
      hideOnMobile: true,
      render: (a) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(a) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-bone hover:text-graphite transition-colors"
              aria-label="Editar"
            >
              <SquarePen size={15} strokeWidth={1.5} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setToDelete(a) }}
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
          Registra lo que sale del inventario sin venderse (mermas, daños, cortesías, traslados): baja el stock proyectado y explica la diferencia contra el conteo físico.
        </p>
        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            Nueva merma
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={3} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Aún no hay mermas"
          description='Registra la primera salida de inventario con el botón "Nueva merma".'
        />
      ) : (
        <DataTable columns={columns} data={sorted} onRowClick={canUpdate ? openEdit : undefined} />
      )}

      <WasteForm open={showForm} onClose={() => setShowForm(false)} adjustment={editing} />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar merma"
        description={
          toDelete
            ? `¿Eliminar la merma del ${toDelete.occurredAt.toDate().toLocaleDateString('es-CO')}? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
