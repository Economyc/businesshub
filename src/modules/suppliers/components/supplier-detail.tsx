import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, AlertTriangle } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { CategorySelect } from '@/core/ui/category-select'
import { StatusBadge } from '@/core/ui/status-badge'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useCompany } from '@/core/hooks/use-company'
import { Skeleton } from '@/core/ui/skeleton'
import { useSupplier } from '../hooks'
import { supplierService } from '../services'
import type { SupplierFormData } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
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

export function SupplierDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { selectedCompany } = useCompany()
  const { data: supplier, loading, error } = useSupplier(id)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

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
    })
    setEditing(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSave() {
    if (!selectedCompany || !id || !displayed) return
    setSaving(true)
    try {
      const updates: Partial<SupplierFormData> = {
        name: editForm.name,
        identification: editForm.identification,
        category: editForm.category,
        contactName: editForm.contactName,
        email: editForm.email,
        phone: editForm.phone,
        contractStart: Timestamp.fromDate(new Date(editForm.contractStart)),
        contractEnd: Timestamp.fromDate(new Date(editForm.contractEnd)),
        status: editForm.status,
      }
      await supplierService.update(selectedCompany.id, id, updates)
      // Update local display data without reloading
      setLocalData({
        ...displayed,
        ...updates,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedCompany || !id) return
    await supplierService.remove(selectedCompany.id, id)
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
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-[10px] bg-warning-bg text-warning-text text-body font-medium border border-warning-text/20">
          <AlertTriangle size={15} strokeWidth={2} />
          {daysUntilExpiry! <= 0
            ? 'El contrato de este proveedor ha vencido o vence hoy.'
            : `El contrato de este proveedor vence en ${daysUntilExpiry} día${daysUntilExpiry === 1 ? '' : 's'}.`}
        </div>
      )}

      <PageHeader title={editing ? 'Editar Proveedor' : displayed.name}>
        {!editing && (
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

      <div className="bg-surface rounded-xl card-elevated p-6">
        {editing ? (
          <div className="grid grid-cols-2 gap-5">
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
              <label className={labelClass}>Inicio de Contrato</label>
              <DateInput
                value={editForm.contractStart}
                onChange={(v) => setEditForm((prev) => ({ ...prev, contractStart: v }))}
              />
            </div>
            <div>
              <label className={labelClass}>Fin de Contrato</label>
              <DateInput
                value={editForm.contractEnd}
                onChange={(v) => setEditForm((prev) => ({ ...prev, contractEnd: v }))}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
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
            <div>
              <p className={labelClass}>Inicio de Contrato</p>
              <p className="text-body text-graphite">{formatDate(displayed.contractStart)}</p>
            </div>
            <div>
              <p className={labelClass}>Fin de Contrato</p>
              <p className="text-body text-graphite">{formatDate(displayed.contractEnd)}</p>
            </div>
            <div>
              <p className={labelClass}>Estado</p>
              <StatusBadge variant={displayed.status} />
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
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
