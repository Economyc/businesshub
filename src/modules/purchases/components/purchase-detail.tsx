import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SelectInput } from '@/core/ui/select-input'
import { StatusBadge } from '@/core/ui/status-badge'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { formatCurrency } from '@/core/utils/format'
import { Skeleton } from '@/core/ui/skeleton'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { usePurchase } from '../hooks'
import { purchaseService } from '../services'
import type { PurchaseStatus, PaymentStatus } from '../types'

const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

const STATUS_MAP: Record<PurchaseStatus, string> = {
  received: 'active',
  partial: 'pending',
  pending: 'pending',
}

const PAYMENT_MAP: Record<PaymentStatus, string> = {
  paid: 'paid',
  pending: 'pending',
  overdue: 'overdue',
}

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  received: 'Recibido',
  partial: 'Parcial',
  pending: 'Pendiente',
}

function formatDate(ts: any): string {
  const d = ts?.toDate?.()
  if (!d) return '—'
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function PurchaseDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: purchase, loading, error } = usePurchase(id)
  const { can } = usePermissions()
  const canEdit = can('finance', 'create')

  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const updateMutation = useFirestoreMutation(
    'purchases',
    (companyId, data: { id: string; updates: any }) => purchaseService.update(companyId, data.id, data.updates),
    { invalidate: ['transactions'] },
  )
  const deleteMutation = useFirestoreMutation(
    'purchases',
    (companyId, purchaseId: string) => purchaseService.remove(companyId, purchaseId),
    { optimisticDelete: true, invalidate: ['transactions'] },
  )

  const [localData, setLocalData] = useState<typeof purchase>(null)
  const displayed = localData ?? purchase

  const [editStatus, setEditStatus] = useState<PurchaseStatus>('received')
  const [editPayment, setEditPayment] = useState<PaymentStatus>('pending')

  function startEditing() {
    if (!displayed) return
    setEditStatus(displayed.status)
    setEditPayment(displayed.paymentStatus)
    setEditing(true)
  }

  async function handleSave() {
    if (!id || !displayed) return
    const updates = { status: editStatus, paymentStatus: editPayment }
    await updateMutation.mutateAsync({ id, updates })
    setLocalData({ ...displayed, ...updates })
    setEditing(false)
  }

  async function handleDelete() {
    if (!id) return
    await deleteMutation.mutateAsync(id)
    navigate('/finance/purchases')
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageTransition>
    )
  }

  if (error || !displayed) {
    return (
      <PageTransition>
        <div className="text-body text-mid-gray py-8 text-center">Compra no encontrada.</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mb-4">
        <button
          onClick={() => navigate('/finance/purchases')}
          className="flex items-center gap-1.5 text-body text-mid-gray hover:text-graphite transition-colors duration-150"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Volver
        </button>
      </div>

      <PageHeader title={`Compra — ${displayed.supplierName}`}>
        {!editing && canEdit && (
          <>
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              <Edit size={14} strokeWidth={1.5} />
              Editar
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-negative-text text-negative-text text-body font-medium transition-all duration-200 hover:bg-negative-bg"
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Eliminar
            </button>
          </>
        )}
      </PageHeader>

      <div className="bg-surface rounded-xl card-elevated p-6 mb-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className={labelClass}>Proveedor</p>
            <p className="text-body text-graphite font-medium">{displayed.supplierName}</p>
          </div>
          <div>
            <p className={labelClass}>Fecha</p>
            <p className="text-body text-graphite">{formatDate(displayed.date)}</p>
          </div>
          <div>
            <p className={labelClass}>N° Factura</p>
            <p className="text-body text-graphite">{displayed.invoiceNumber || '—'}</p>
          </div>
          <div>
            <p className={labelClass}>Fecha Vencimiento Pago</p>
            <p className="text-body text-graphite">{formatDate(displayed.paymentDueDate)}</p>
          </div>
          {editing ? (
            <>
              <div>
                <label className={labelClass}>Estado Recepción</label>
                <SelectInput
                  value={editStatus}
                  onChange={(v) => setEditStatus(v as PurchaseStatus)}
                  options={[
                    { value: 'received', label: 'Recibido' },
                    { value: 'partial', label: 'Parcial' },
                    { value: 'pending', label: 'Pendiente' },
                  ]}
                />
              </div>
              <div>
                <label className={labelClass}>Estado de Pago</label>
                <SelectInput
                  value={editPayment}
                  onChange={(v) => setEditPayment(v as PaymentStatus)}
                  options={[
                    { value: 'paid', label: 'Pagado' },
                    { value: 'pending', label: 'Pendiente' },
                    { value: 'overdue', label: 'Vencido' },
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className={labelClass}>Estado Recepción</p>
                <StatusBadge variant={STATUS_MAP[displayed.status] as any} label={STATUS_LABELS[displayed.status]} />
              </div>
              <div>
                <p className={labelClass}>Estado de Pago</p>
                <StatusBadge variant={PAYMENT_MAP[displayed.paymentStatus] as any} />
              </div>
            </>
          )}
        </div>
        {displayed.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className={labelClass}>Notas</p>
            <p className="text-body text-graphite">{displayed.notes}</p>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex gap-3 mb-5">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="bg-surface rounded-xl card-elevated p-6">
        <h3 className="text-body font-medium text-dark-graphite mb-4">Detalle de Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="text-caption uppercase tracking-wider text-mid-gray border-b border-border">
                <th className="text-left py-2 pr-4">Producto</th>
                <th className="text-right py-2 px-4">Cantidad</th>
                <th className="text-left py-2 px-4">Unidad</th>
                <th className="text-right py-2 px-4">Precio Unit.</th>
                <th className="text-right py-2 pl-4">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {displayed.items.map((item, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2.5 pr-4 text-graphite">{item.productName}</td>
                  <td className="py-2.5 px-4 text-right text-graphite">{item.quantity}</td>
                  <td className="py-2.5 px-4 text-graphite">{item.unit}</td>
                  <td className="py-2.5 px-4 text-right text-graphite">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2.5 pl-4 text-right font-medium text-graphite">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={4} className="py-2.5 text-right text-graphite">Subtotal</td>
                <td className="py-2.5 pl-4 text-right font-medium">{formatCurrency(displayed.subtotal)}</td>
              </tr>
              {displayed.tax > 0 && (
                <tr>
                  <td colSpan={4} className="py-1 text-right text-mid-gray">IVA</td>
                  <td className="py-1 pl-4 text-right text-mid-gray">{formatCurrency(displayed.tax)}</td>
                </tr>
              )}
              <tr className="border-t border-border">
                <td colSpan={4} className="py-2.5 text-right text-dark-graphite font-semibold">Total</td>
                <td className="py-2.5 pl-4 text-right text-dark-graphite font-semibold">{formatCurrency(displayed.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar Compra"
        description={`¿Estás seguro de que deseas eliminar esta compra de ${displayed.supplierName}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </PageTransition>
  )
}
