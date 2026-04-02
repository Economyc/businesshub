import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { modalVariants } from '@/core/animations/variants'
import { talentService } from '../services'
import type { Employee } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

function toDateInputValue(ts: Timestamp | undefined): string {
  if (!ts) return ''
  const d = ts.toDate()
  return d.toISOString().split('T')[0]
}

interface EmployeeFormProps {
  open: boolean
  onClose: () => void
  employee?: Employee | null
}

export function EmployeeForm({ open, onClose, employee }: EmployeeFormProps) {
  const { selectedCompany, roles, departments } = useCompany()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isEditing = !!employee

  const saveMutation = useFirestoreMutation(
    'employees',
    (companyId: string, data: { id?: string; [key: string]: unknown }) => {
      const { id, ...rest } = data
      return id
        ? talentService.update(companyId, id, rest)
        : talentService.create(companyId, rest)
    },
  )

  const deleteMutation = useFirestoreMutation(
    'employees',
    (companyId: string, id: string) => talentService.remove(companyId, id),
    { optimisticDelete: true },
  )

  const [form, setForm] = useState({
    name: '',
    identification: '',
    role: '',
    department: '',
    email: '',
    phone: '',
    salary: '',
    startDate: '',
    status: 'active' as 'active' | 'inactive',
  })

  useEffect(() => {
    if (open && employee) {
      setForm({
        name: employee.name,
        identification: employee.identification ?? '',
        role: employee.role,
        department: employee.department,
        email: employee.email,
        phone: employee.phone,
        salary: String(employee.salary ?? ''),
        startDate: toDateInputValue(employee.startDate),
        status: employee.status,
      })
    } else if (open && !employee) {
      resetForm()
    }
  }, [open, employee?.id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function resetForm() {
    setForm({
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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    const data = {
      name: form.name,
      identification: form.identification,
      role: form.role,
      department: form.department,
      email: form.email,
      phone: form.phone,
      salary: Number(form.salary),
      startDate: Timestamp.fromDate(new Date(form.startDate)),
      status: form.status,
    }
    await saveMutation.mutateAsync(isEditing ? { id: employee.id, ...data } : data)
    resetForm()
    onClose()
  }

  async function handleDelete() {
    if (!selectedCompany || !employee) return
    await deleteMutation.mutateAsync(employee.id)
    setDeleteOpen(false)
    resetForm()
    onClose()
  }

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function handleCancel() {
    resetForm()
    setDeleteOpen(false)
    onClose()
  }

  return (
    <>
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={handleCancel}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-2xl mx-4 border border-border"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h2 className="text-subheading font-semibold text-dark-graphite">
                {isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h2>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Nombre</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Nombre completo"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Identificación</label>
                  <input
                    name="identification"
                    value={form.identification}
                    onChange={handleChange}
                    placeholder="Cédula o NIT"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Cargo</label>
                  {roles.length > 0 ? (
                    <SelectInput
                      value={form.role}
                      onChange={(v) => setForm((prev) => ({ ...prev, role: v }))}
                      options={roles.map((r) => ({ value: r, label: r }))}
                      placeholder="Seleccionar cargo"
                    />
                  ) : (
                    <input
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                      required
                      placeholder="Título del puesto"
                      className={inputClass}
                    />
                  )}
                </div>
                <div>
                  <label className={labelClass}>Departamento</label>
                  {departments.length > 0 ? (
                    <SelectInput
                      value={form.department}
                      onChange={(v) => setForm((prev) => ({ ...prev, department: v }))}
                      options={departments.map((d) => ({ value: d, label: d }))}
                      placeholder="Seleccionar departamento"
                    />
                  ) : (
                    <input
                      name="department"
                      value={form.department}
                      onChange={handleChange}
                      required
                      placeholder="Departamento"
                      className={inputClass}
                    />
                  )}
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="correo@empresa.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Teléfono</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+1 000 000 0000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Salario</label>
                  <CurrencyInput
                    name="salary"
                    value={form.salary}
                    onChange={(raw) => setForm((prev) => ({ ...prev, salary: raw }))}
                    required
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Fecha de Inicio</label>
                  <DateInput
                    value={form.startDate}
                    onChange={(v) => setForm((prev) => ({ ...prev, startDate: v }))}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <SelectInput
                    value={form.status}
                    onChange={(v) => setForm((prev) => ({ ...prev, status: v as 'active' | 'inactive' }))}
                    options={[
                      { value: 'active', label: 'Activo' },
                      { value: 'inactive', label: 'Inactivo' },
                    ]}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                    title="Eliminar empleado"
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saveMutation.isPending ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Guardar Empleado'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <ConfirmDialog
      open={deleteOpen}
      title="Eliminar Empleado"
      description={`¿Estás seguro de que deseas eliminar a ${form.name || 'este empleado'}? Esta acción no se puede deshacer.`}
      onConfirm={handleDelete}
      onCancel={() => setDeleteOpen(false)}
    />
    </>
  )
}
