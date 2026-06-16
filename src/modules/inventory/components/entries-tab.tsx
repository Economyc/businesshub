import { useState, useMemo } from 'react'
import { Plus, PackagePlus, SquarePen, Trash2 } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { formatCurrency } from '@/core/utils/format'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useSuppliers } from '@/modules/suppliers/hooks'
import { useReceipts, useReceiptMutations } from '../hooks/use-receipts'
import { EntryForm } from './entry-form'
import type { InventoryReceipt } from '../types'

/** Costo total de una entrada = Σ qty·unitCost. null si ninguna línea tiene costo. */
function receiptTotal(receipt: InventoryReceipt): number | null {
  let total = 0
  let hasCost = false
  for (const line of receipt.lines) {
    if (line.unitCost != null && line.unitCost > 0) {
      total += line.qty * line.unitCost
      hasCost = true
    }
  }
  return hasCost ? total : null
}

export function EntriesTab() {
  const { can } = usePermissions()
  const canCreate = can('inventory', 'create')
  const canUpdate = can('inventory', 'update')
  const canDelete = can('inventory', 'delete')

  const { data: receipts, loading } = useReceipts()
  const { data: suppliers } = useSuppliers()
  const { remove } = useReceiptMutations()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InventoryReceipt | null>(null)
  const [toDelete, setToDelete] = useState<InventoryReceipt | null>(null)

  const supplierName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of suppliers) map[s.id] = s.name
    return map
  }, [suppliers])

  const sorted = useMemo(
    () => [...receipts].sort((a, b) => b.receivedAt.toMillis() - a.receivedAt.toMillis()),
    [receipts],
  )

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(receipt: InventoryReceipt) {
    if (!canUpdate) return
    setEditing(receipt)
    setShowForm(true)
  }

  async function confirmDelete() {
    if (!toDelete) return
    await remove.mutateAsync(toDelete.id)
    setToDelete(null)
  }

  const columns: Column<InventoryReceipt>[] = [
    {
      key: 'date',
      header: 'Fecha',
      width: '1.4fr',
      primary: true,
      render: (r) => (
        <div className="font-medium text-dark-graphite">
          {r.receivedAt.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Proveedor',
      width: '1.6fr',
      render: (r) =>
        r.supplierId && supplierName[r.supplierId] ? (
          <span className="truncate">{supplierName[r.supplierId]}</span>
        ) : (
          <span className="text-mid-gray">—</span>
        ),
    },
    { key: 'lines', header: 'Insumos', width: '1fr', render: (r) => `${r.lines.length}` },
    {
      key: 'total',
      header: 'Costo total',
      width: '1.2fr',
      render: (r) => {
        const total = receiptTotal(r)
        return total != null ? formatCurrency(total) : <span className="text-mid-gray">—</span>
      },
    },
    {
      key: 'actions',
      header: '',
      width: '88px',
      hideOnMobile: true,
      render: (r) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(r) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-bone hover:text-graphite transition-colors"
              aria-label="Editar"
            >
              <SquarePen size={15} strokeWidth={1.5} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setToDelete(r) }}
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
          Registra las compras recibidas: suben el stock proyectado desde la fecha de recepción. La cantidad va en la unidad de compra del insumo.
        </p>
        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            Nueva entrada
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title="Aún no hay entradas"
          description='Registra la primera compra recibida con el botón "Nueva entrada" para subir el stock.'
        />
      ) : (
        <DataTable
          columns={columns}
          data={sorted}
          onRowClick={canUpdate ? openEdit : undefined}
          mobileCardHeight={canUpdate || canDelete ? 140 : undefined}
          mobileActions={
            canUpdate || canDelete
              ? (r) => (
                  <>
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-input-border text-graphite text-caption font-medium active:bg-bone transition-colors"
                      >
                        <SquarePen size={16} strokeWidth={1.5} />
                        Editar
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setToDelete(r)}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-mid-gray border border-input-border active:bg-negative-bg active:text-negative-text transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    )}
                  </>
                )
              : undefined
          }
        />
      )}

      <EntryForm open={showForm} onClose={() => setShowForm(false)} receipt={editing} />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar entrada"
        description={
          toDelete
            ? `¿Eliminar la entrada del ${toDelete.receivedAt.toDate().toLocaleDateString('es-CO')}? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
