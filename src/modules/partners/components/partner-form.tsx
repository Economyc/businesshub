import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2 } from 'lucide-react'
import { CurrencyInput } from '@/core/ui/currency-input'
import { SelectInput } from '@/core/ui/select-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useCompany } from '@/core/hooks/use-company'
import { modalVariants } from '@/core/animations/variants'
import { partnerService } from '../services'
import type { Partner } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface PartnerFormProps {
  open: boolean
  onClose: () => void
  partner?: Partner | null
}

export function PartnerForm({ open, onClose, partner }: PartnerFormProps) {
  const { selectedCompany } = useCompany()
  const [submitting, setSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isEditing = !!partner

  const [form, setForm] = useState({
    name: '',
    identification: '',
    email: '',
    phone: '',
    ownership: '',
    investment: '',
    status: 'active' as 'active' | 'inactive',
  })

  useEffect(() => {
    if (open && partner) {
      setForm({
        name: partner.name,
        identification: partner.identification ?? '',
        email: partner.email ?? '',
        phone: partner.phone ?? '',
        ownership: String(partner.ownership ?? ''),
        investment: String(partner.investment ?? ''),
        status: partner.status,
      })
    } else if (open && !partner) {
      resetForm()
    }
  }, [open, partner?.id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function resetForm() {
    setForm({ name: '', identification: '', email: '', phone: '', ownership: '', investment: '', status: 'active' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    setSubmitting(true)
    try {
      const data = {
        name: form.name,
        identification: form.identification,
        email: form.email,
        phone: form.phone,
        ownership: Number(form.ownership),
        investment: Number(form.investment),
        status: form.status,
      }
      if (isEditing) {
        await partnerService.update(selectedCompany.id, partner.id, data)
      } else {
        await partnerService.create(selectedCompany.id, data)
      }
      resetForm()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!selectedCompany || !partner) return
    await partnerService.remove(selectedCompany.id, partner.id)
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
                {isEditing ? 'Editar Socio' : 'Nuevo Socio'}
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
                  <label className={labelClass}>Email</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
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
                  <label className={labelClass}>Participación (%)</label>
                  <div className="relative">
                    <input
                      name="ownership"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.ownership}
                      onChange={handleChange}
                      required
                      placeholder="0"
                      className={`${inputClass} ${form.ownership ? 'pr-8' : ''}`}
                    />
                    {form.ownership && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mid-gray pointer-events-none select-none">%</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Inversión</label>
                  <CurrencyInput
                    name="investment"
                    value={form.investment}
                    onChange={(raw) => setForm((prev) => ({ ...prev, investment: raw }))}
                    required
                    placeholder="0"
                    className={inputClass}
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
                    title="Eliminar socio"
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
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Guardar Socio'}
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
      title="Eliminar Socio"
      description={`¿Estás seguro de que deseas eliminar a ${form.name || 'este socio'}? Esta acción no se puede deshacer.`}
      onConfirm={handleDelete}
      onCancel={() => setDeleteOpen(false)}
    />
    </>
  )
}
