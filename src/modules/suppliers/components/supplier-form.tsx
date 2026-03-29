import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { CategorySelect } from '@/core/ui/category-select'
import { useCompany } from '@/core/hooks/use-company'
import { modalVariants } from '@/core/animations/variants'
import { supplierService } from '../services'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface SupplierFormProps {
  open: boolean
  onClose: () => void
}

export function SupplierForm({ open, onClose }: SupplierFormProps) {
  const { selectedCompany } = useCompany()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    identification: '',
    category: '',
    contactName: '',
    email: '',
    phone: '',
    contractStart: '',
    contractEnd: '',
    status: 'active' as 'active' | 'expired' | 'pending',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function resetForm() {
    setForm({
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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    setSubmitting(true)
    try {
      await supplierService.create(selectedCompany.id, {
        name: form.name,
        identification: form.identification,
        category: form.category,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        contractStart: Timestamp.fromDate(new Date(form.contractStart)),
        contractEnd: Timestamp.fromDate(new Date(form.contractEnd)),
        status: form.status,
      })
      resetForm()
      onClose()
    } finally {
      setSubmitting(false)
    }
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
    onClose()
  }

  return (
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
              <h2 className="text-subheading font-semibold text-dark-graphite">Nuevo Proveedor</h2>
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
                    placeholder="Nombre del proveedor"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Identificación</label>
                  <input
                    name="identification"
                    value={form.identification}
                    onChange={handleChange}
                    required
                    placeholder="NIT o cédula"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Categoría</label>
                  <CategorySelect
                    value={form.category}
                    onChange={(v) => setForm((prev) => ({ ...prev, category: v }))}
                    placeholder="Seleccionar categoría"
                    allowCustom
                  />
                </div>
                <div>
                  <label className={labelClass}>Nombre de Contacto</label>
                  <input
                    name="contactName"
                    value={form.contactName}
                    onChange={handleChange}
                    required
                    placeholder="Nombre del contacto"
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
                    required
                    placeholder="correo@proveedor.com"
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
                  <label className={labelClass}>Estado</label>
                  <SelectInput
                    value={form.status}
                    onChange={(v) => setForm((prev) => ({ ...prev, status: v as 'active' | 'expired' | 'pending' }))}
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
                    value={form.contractStart}
                    onChange={(v) => setForm((prev) => ({ ...prev, contractStart: v }))}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
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
                  {submitting ? 'Guardando...' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
