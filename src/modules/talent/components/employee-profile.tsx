import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, User, FileText } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { StatusBadge } from '@/core/ui/status-badge'
import { CurrencyInput } from '@/core/ui/currency-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { formatCurrency } from '@/core/utils/format'
import { Skeleton } from '@/core/ui/skeleton'
import { useEmployee } from '../hooks'
import { talentService } from '../services'
import { EmployeeDocuments } from './employee-documents'
import type { EmployeeFormData } from '../types'

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

export function EmployeeProfile() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { selectedCompany } = useCompany()
  const { data: employee, loading, error } = useEmployee(id)

  const [activeTab, setActiveTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const updateMutation = useFirestoreMutation(
    'employees',
    (companyId: string, data: { id: string; updates: Partial<EmployeeFormData> }) =>
      talentService.update(companyId, data.id, data.updates),
  )

  const deleteMutation = useFirestoreMutation(
    'employees',
    (companyId: string, id: string) => talentService.remove(companyId, id),
    { optimisticDelete: true },
  )

  // Local override after save so we don't need window.location.reload
  const [localData, setLocalData] = useState<typeof employee>(null)

  const displayed = localData ?? employee

  const [editForm, setEditForm] = useState<{
    name: string
    identification: string
    role: string
    department: string
    email: string
    phone: string
    salary: string
    startDate: string
    status: 'active' | 'inactive'
  }>({
    name: '',
    identification: '',
    role: '',
    department: '',
    email: '',
    phone: '',
    salary: '',
    startDate: '',
    status: 'active',
  })

  function startEditing() {
    if (!displayed) return
    setEditForm({
      name: displayed.name,
      identification: displayed.identification ?? '',
      role: displayed.role,
      department: displayed.department,
      email: displayed.email,
      phone: displayed.phone,
      salary: String(displayed.salary ?? ''),
      startDate: toDateInputValue(displayed.startDate),
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
    const updates: Partial<EmployeeFormData> = {
      name: editForm.name,
      identification: editForm.identification,
      role: editForm.role,
      department: editForm.department,
      email: editForm.email,
      phone: editForm.phone,
      salary: Number(editForm.salary),
      startDate: Timestamp.fromDate(new Date(editForm.startDate)),
      status: editForm.status,
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
    navigate('/talent')
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
        <div className="text-body text-mid-gray py-8 text-center">Empleado no encontrado.</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mb-4">
        <button
          onClick={() => navigate('/talent')}
          className="flex items-center gap-1.5 text-body text-mid-gray hover:text-graphite transition-colors duration-150"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Volver
        </button>
      </div>

      <PageHeader title={editing ? 'Editar Empleado' : displayed.name}>
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

      <UnderlineButtonTabs
        tabs={[
          { value: 'info', label: 'Información', icon: User },
          { value: 'documents', label: 'Documentos', icon: FileText },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'info' && (
        <>
          <div className="bg-surface rounded-xl card-elevated p-6">
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Nombre</label>
                  <input name="name" value={editForm.name} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Identificación</label>
                  <input name="identification" value={editForm.identification} onChange={handleChange} placeholder="Cédula o NIT" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Cargo</label>
                  <input name="role" value={editForm.role} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Departamento</label>
                  <input name="department" value={editForm.department} onChange={handleChange} className={inputClass} />
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
                  <label className={labelClass}>Salario</label>
                  <CurrencyInput name="salary" value={editForm.salary} onChange={(raw) => setEditForm((prev) => ({ ...prev, salary: raw }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Fecha de Inicio</label>
                  <DateInput
                    value={editForm.startDate}
                    onChange={(v) => setEditForm((prev) => ({ ...prev, startDate: v }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <SelectInput
                    value={editForm.status}
                    onChange={(v) => setEditForm((prev) => ({ ...prev, status: v as 'active' | 'inactive' }))}
                    options={[
                      { value: 'active', label: 'Activo' },
                      { value: 'inactive', label: 'Inactivo' },
                    ]}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className={labelClass}>Identificación</p>
                  <p className="text-body text-graphite">{displayed.identification || '—'}</p>
                </div>
                <div>
                  <p className={labelClass}>Cargo</p>
                  <p className="text-body text-graphite">{displayed.role}</p>
                </div>
                <div>
                  <p className={labelClass}>Departamento</p>
                  <p className="text-body text-graphite">{displayed.department}</p>
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
                  <p className={labelClass}>Salario</p>
                  <p className="text-body text-graphite">
                    {formatCurrency(displayed.salary ?? 0)}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>Fecha de Inicio</p>
                  <p className="text-body text-graphite">{formatDate(displayed.startDate)}</p>
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
        </>
      )}

      {activeTab === 'documents' && id && (
        <EmployeeDocuments employeeId={id} />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar Empleado"
        description={`¿Estás seguro de que deseas eliminar a ${displayed.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </PageTransition>
  )
}
