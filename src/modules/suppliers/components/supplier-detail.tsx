import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, AlertTriangle, Info, ShoppingCart, Package } from 'lucide-react'
import { usePermissions } from '@/core/hooks/use-permissions'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { CategorySelect } from '@/core/ui/category-select'
import { StatusBadge } from '@/core/ui/status-badge'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { Skeleton } from '@/core/ui/skeleton'
import { useSupplier } from '../hooks'
import { useSupplierPurchases } from '@/modules/purchases/hooks'
import { supplierService } from '../services'
import { formatCurrency } from '@/core/utils/format'
import type { SupplierFormData } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
}

function toDateInputValue(ts: Timestamp | undefined): string {
  if (!ts) return ''
  const d = ts.toDate()
  return d.toISOString().split('T')[0]
}

function getDaysUntilExpiry(ts: Timestamp | undefined): number | null {
  if (!ts) return null
  return Math.ceil((ts.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const SUPPLIER_TABS = [
  { value: 'info', label: 'Información', icon: Info },
  { value: 'purchases', label: 'Compras', icon: ShoppingCart },
  { value: 'products', label: 'Productos', icon: Package },
]

export function SupplierDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { selectedCompany } = useCompany()
  const { data: supplier, loading, error } = useSupplier(id)
  const { can } = usePermissions()
  const canEdit = can('suppliers', 'create')

  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const { supplierData } = useSupplierPurchases(id)

  const updateMutation = useFirestoreMutation(
    'suppliers',
    (companyId: string, data: { id: string; updates: Partial<SupplierFormData> }) =>
      supplierService.update(companyId, data.id, data.updates),
  )

  const deleteMutation = useFirestoreMutation(
    'suppliers',
    (companyId: string, id: string) => supplierService.remove(companyId, id),
    { optimisticDelete: true },
  )

  // Local override after save so we don't need window.location.reload
  const [localData, setLocalData] = useState<typeof supplier>(null)

  const displayed = localData ?? supplier

  const [editForm, setEditForm] = useState<{
    name: string
    identification: string
    category: string
    contactName: string
    email: string
    phone: string
    contractStart: string
    contractEnd: string
    status: 'active' | 'expired' | 'pending'
    paymentTerms: string
    creditLimit: string
  }>({
    name: '',
    identification: '',
    category: '',
    contactName: '',
    email: '',
    phone: '',
    contractStart: '',
    contractEnd: '',
    status: 'active',
    paymentTerms: '0',
    creditLimit: '',
  })

  function startEditing() {
    if (!displayed) return
    setEditForm({
      name: displayed.name,
      identification: displayed.identification || '',
      category: displayed.category,
      contactName: displayed.contactName,
      email: displayed.email,
      phone: displayed.phone,
      contractStart: toDateInputValue(displayed.contractStart),
      contractEnd: toDateInputValue(displayed.contractEnd),
      status: displayed.status,
      paymentTerms: String(displayed.paymentTerms ?? 0),
      creditLimit: displayed.creditLimit ? String(displayed.creditLimit) : '',
    })
    setEditing(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSave() {
    if (!selectedCompany || !id || !displayed) return
    const updates: Partial<SupplierFormData> = {
      name: editForm.name,
      identification: editForm.identification,
      category: editForm.category,
      contactName: editForm.contactName,
      email: editForm.email,
      phone: editForm.phone,
      contractStart: editForm.contractStart ? Timestamp.fromDate(new Date(editForm.contractStart)) : undefined,
      contractEnd: editForm.contractEnd ? Timestamp.fromDate(new Date(editForm.contractEnd)) : undefined,
      status: editForm.status,
      paymentTerms: Number(editForm.paymentTerms),
      creditLimit: editForm.creditLimit ? Number(editForm.creditLimit) : undefined,
    }
    await updateMutation.mutateAsync({ id, updates })
    // Update local display data without reloading
    setLocalData({
      ...displayed,
      ...updates,
    })
    setEditing(false)
  }

  async function handleDelete() {
    if (!selectedCompany || !id) return
    await deleteMutation.mutateAsync(id)
    navigate('/suppliers')
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
        <div className="text-body text-mid-gray py-8 text-center">Proveedor no encontrado.</div>
      </PageTransition>
    )
  }

  const daysUntilExpiry = getDaysUntilExpiry(displayed.contractEnd)
  const isExpiringSoon = displayed.status === 'active' && daysUntilExpiry !== null && daysUntilExpiry <= 30

  return (
    <PageTransition>
      <div className="mb-4">
        <button
          onClick={() => navigate('/suppliers')}
          className="flex items-center gap-1.5 text-body text-mid-gray hover:text-graphite transition-colors duration-150"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Volver
        </button>
      </div>

      {isExpiringSoon && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-lg bg-warning-bg text-warning-text text-body font-medium border border-warning-text/20">
          <AlertTriangle size={15} strokeWidth={2} />
          {daysUntilExpiry! <= 0
            ? 'El contrato de este proveedor ha vencido o vence hoy.'
            : `El contrato de este proveedor vence en ${daysUntilExpiry} día${daysUntilExpiry === 1 ? '' : 's'}.`}
        </div>
      )}

      <PageHeader title={editing ? 'Editar Proveedor' : displayed.name}>
        {!editing && canEdit && (
          <>
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              <Edit size={14} strokeWidth={1.5} />
              Editar
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-negative-text text-negative-text text-body font-medium transition-all duration-200 hover:bg-negative-bg"
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Eliminar
            </button>
          </>
        )}
      </PageHeader>

      {!editing && (
        <UnderlineButtonTabs tabs={SUPPLIER_TABS} active={activeTab} onChange={setActiveTab} />
      )}

      {editing && (
        <div className="bg-surface rounded-xl card-elevated p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Nombre</label>
              <input name="name" value={editForm.name} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Identificación</label>
              <input name="identification" value={editForm.identification} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Categoría</label>
              <CategorySelect
                value={editForm.category}
                onChange={(v) => setEditForm((prev) => ({ ...prev, category: v }))}
                allowCustom
              />
            </div>
            <div>
              <label className={labelClass}>Nombre de Contacto</label>
              <input name="contactName" value={editForm.contactName} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="email" type="email" value={editForm.email} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input name="phone" value={editForm.phone} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <SelectInput
                value={editForm.status}
                onChange={(v) => setEditForm((prev) => ({ ...prev, status: v as 'active' | 'expired' | 'pending' }))}
                options={[
                  { value: 'active', label: 'Activo' },
                  { value: 'expired', label: 'Vencido' },
                  { value: 'pending', label: 'Pendiente' },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Inicio de Contrato (opcional)</label>
              <DateInput
                value={editForm.contractStart}
                onChange={(v) => setEditForm((prev) => ({ ...prev, contractStart: v }))}
              />
            </div>
            <div>
              <label className={labelClass}>Fin de Contrato (opcional)</label>
              <DateInput
                value={editForm.contractEnd}
                onChange={(v) => setEditForm((prev) => ({ ...prev, contractEnd: v }))}
              />
            </div>
            <div>
              <label className={labelClass}>Plazo de Pago</label>
              <SelectInput
                value={editForm.paymentTerms}
                onChange={(v) => setEditForm((prev) => ({ ...prev, paymentTerms: v }))}
                options={[
                  { value: '0', label: 'Contado' },
                  { value: '15', label: '15 días' },
                  { value: '30', label: '30 días' },
                  { value: '45', label: '45 días' },
                  { value: '60', label: '60 días' },
                  { value: '90', label: '90 días' },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Cupo de Crédito (opcional)</label>
              <CurrencyInput
                name="creditLimit"
                value={editForm.creditLimit}
                onChange={(raw) => setEditForm((prev) => ({ ...prev, creditLimit: raw }))}
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      {!editing && activeTab === 'info' && (
        <div className="bg-surface rounded-xl card-elevated p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className={labelClass}>Identificación</p>
              <p className="text-body text-graphite">{displayed.identification || '—'}</p>
            </div>
            <div>
              <p className={labelClass}>Categoría</p>
              <p className="text-body text-graphite">{displayed.category}</p>
            </div>
            <div>
              <p className={labelClass}>Nombre de Contacto</p>
              <p className="text-body text-graphite">{displayed.contactName}</p>
            </div>
            <div>
              <p className={labelClass}>Email</p>
              <p className="text-body text-graphite">{displayed.email}</p>
            </div>
            <div>
              <p className={labelClass}>Teléfono</p>
              <p className="text-body text-graphite">{displayed.phone}</p>
            </div>
            {displayed.contractStart && (
              <div>
                <p className={labelClass}>Inicio de Contrato</p>
                <p className="text-body text-graphite">{formatDate(displayed.contractStart)}</p>
              </div>
            )}
            {displayed.contractEnd && (
              <div>
                <p className={labelClass}>Fin de Contrato</p>
                <p className="text-body text-graphite">{formatDate(displayed.contractEnd)}</p>
              </div>
            )}
            <div>
              <p className={labelClass}>Estado</p>
              <StatusBadge variant={displayed.status} />
            </div>
            <div>
              <p className={labelClass}>Plazo de Pago</p>
              <p className="text-body text-graphite">{displayed.paymentTerms ? `${displayed.paymentTerms} días` : 'Contado'}</p>
            </div>
            {displayed.creditLimit && (
              <div>
                <p className={labelClass}>Cupo de Crédito</p>
                <p className="text-body text-graphite">{formatCurrency(displayed.creditLimit)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!editing && activeTab === 'purchases' && (
        <div>
          {/* 3 stat cards */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-surface rounded-xl p-[18px] card-elevated">
              <span className="text-caption uppercase tracking-wider text-mid-gray">Total Gastado</span>
              <div className="text-kpi font-semibold text-dark-graphite mt-1">{formatCurrency(supplierData.totalSpent)}</div>
            </div>
            <div className="bg-surface rounded-xl p-[18px] card-elevated">
              <span className="text-caption uppercase tracking-wider text-mid-gray">Compras Realizadas</span>
              <div className="text-kpi font-semibold text-dark-graphite mt-1">{supplierData.purchaseCount}</div>
            </div>
            <div className="bg-surface rounded-xl p-[18px] card-elevated">
              <span className="text-caption uppercase tracking-wider text-mid-gray">Ticket Promedio</span>
              <div className="text-kpi font-semibold text-dark-graphite mt-1">{formatCurrency(supplierData.purchaseCount > 0 ? supplierData.totalSpent / supplierData.purchaseCount : 0)}</div>
            </div>
          </div>
          {/* Purchases table */}
          {supplierData.purchases.length === 0 ? (
            <div className="text-body text-mid-gray py-8 text-center">No hay compras registradas con este proveedor.</div>
          ) : (
            <div className="bg-surface rounded-xl card-elevated p-6">
              <table className="w-full text-body">
                <thead>
                  <tr className="text-caption uppercase tracking-wider text-mid-gray border-b border-border">
                    <th className="text-left py-2 pr-4">Fecha</th>
                    <th className="text-left py-2 px-4">N° Factura</th>
                    <th className="text-right py-2 px-4">Total</th>
                    <th className="text-left py-2 pl-4">Estado Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierData.purchases.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 text-graphite">{p.date?.toDate().toLocaleDateString('es-CO')}</td>
                      <td className="py-2.5 px-4 text-graphite">{p.invoiceNumber || '—'}</td>
                      <td className="py-2.5 px-4 text-right text-graphite font-medium">{formatCurrency(p.total)}</td>
                      <td className="py-2.5 pl-4"><StatusBadge variant={p.paymentStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!editing && activeTab === 'products' && (
        <div>
          {supplierData.productBreakdown.length === 0 ? (
            <div className="text-body text-mid-gray py-8 text-center">No hay productos registrados.</div>
          ) : (
            <div className="bg-surface rounded-xl card-elevated p-6">
              <table className="w-full text-body">
                <thead>
                  <tr className="text-caption uppercase tracking-wider text-mid-gray border-b border-border">
                    <th className="text-left py-2 pr-4">Producto</th>
                    <th className="text-right py-2 px-4">Cantidad</th>
                    <th className="text-right py-2 px-4">Total</th>
                    <th className="text-right py-2 pl-4">Precio Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierData.productBreakdown.map((p, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 text-graphite font-medium">{p.productName}</td>
                      <td className="py-2.5 px-4 text-right text-graphite">{p.totalQty}</td>
                      <td className="py-2.5 px-4 text-right text-graphite">{formatCurrency(p.totalSpent)}</td>
                      <td className="py-2.5 pl-4 text-right text-graphite">{formatCurrency(p.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-5 py-2.5 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
          >
            Cancelar
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar Proveedor"
        description={`¿Estás seguro de que deseas eliminar a ${displayed.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </PageTransition>
  )
}
