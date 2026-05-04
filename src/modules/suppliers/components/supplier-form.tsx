import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { CategorySelect } from '@/core/ui/category-select'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { modalVariants } from '@/core/animations/variants'
import { supplierService } from '../services'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface SupplierFormProps {
  open: boolean
  onClose: () => void
}

export function SupplierForm({ open, onClose }: SupplierFormProps) {
  const { selectedCompany } = useCompany()

  const createMutation = useFirestoreMutation(
    'suppliers',
    (companyId: string, data: any) => supplierService.create(companyId, data),
  )

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
    paymentTerms: '0',
    creditLimit: '',
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
      paymentTerms: '0',
      creditLimit: '',
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    await createMutation.mutateAsync({
      name: form.name,
      identification: form.identification,
      category: form.category,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone,
      contractStart: form.contractStart ? Timestamp.fromDate(new Date(form.contractStart)) : undefined,
      contractEnd: form.contractEnd ? Timestamp.fromDate(new Date(form.contractEnd)) : undefined,
      status: form.status,
      paymentTerms: Number(form.paymentTerms),
      creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
    })
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
            className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-2xl mx-4 border border-border max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <h2 className="text-subheading font-semibold text-dark-graphite">Nuevo Proveedor</h2>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                  <label className={labelClass}>Plazo de Pago</label>
                  <SelectInput
                    value={form.paymentTerms}
                    onChange={(v) => setForm((prev) => ({ ...prev, paymentTerms: v }))}
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
                    value={form.creditLimit}
                    onChange={(raw) => setForm((prev) => ({ ...prev, creditLimit: raw }))}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Inicio de Contrato (opcional)</label>
                  <DateInput
                    value={form.contractStart}
                    onChange={(v) => setForm((prev) => ({ ...prev, contractStart: v }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Fin de Contrato (opcional)</label>
                  <DateInput
                    value={form.contractEnd}
                    onChange={(v) => setForm((prev) => ({ ...prev, contractEnd: v }))}
                  />
                </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? 'Guardando...' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
