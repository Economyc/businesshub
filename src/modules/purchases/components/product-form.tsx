import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { useCompany } from '@/core/hooks/use-company'
import { modalVariants } from '@/core/animations/variants'
import { productService } from '../services'
import { UNIT_OPTIONS } from '../types'
import type { Product } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  product?: Product | null
}

export function ProductForm({ open, onClose, product }: ProductFormProps) {
  const { selectedCompany } = useCompany()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    category: '',
    unit: 'kg',
    referencePrice: '',
    reorderPoint: '',
    perishable: false,
    active: true,
  })

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        category: product.category,
        unit: product.unit,
        referencePrice: String(product.referencePrice),
        reorderPoint: product.reorderPoint ? String(product.reorderPoint) : '',
        perishable: product.perishable,
        active: product.active,
      })
    } else {
      resetForm()
    }
  }, [product, open])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function resetForm() {
    setForm({ name: '', category: '', unit: 'kg', referencePrice: '', reorderPoint: '', perishable: false, active: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    setSubmitting(true)
    try {
      const data = {
        name: form.name,
        category: form.category,
        unit: form.unit,
        referencePrice: Number(form.referencePrice),
        reorderPoint: form.reorderPoint ? Number(form.reorderPoint) : null,
        perishable: form.perishable,
        active: form.active,
      }
      if (product) {
        await productService.update(selectedCompany.id, product.id, data)
      } else {
        await productService.create(selectedCompany.id, data as any)
      }
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
              <h2 className="text-subheading font-semibold text-dark-graphite">
                {product ? 'Editar Insumo' : 'Nuevo Insumo'}
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
                    placeholder="Nombre del insumo"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Categoría</label>
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                    placeholder="Ej: Proteínas, Lácteos..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Unidad de Medida</label>
                  <SelectInput
                    value={form.unit}
                    onChange={(v) => setForm((prev) => ({ ...prev, unit: v }))}
                    options={UNIT_OPTIONS}
                  />
                </div>
                <div>
                  <label className={labelClass}>Precio de Referencia</label>
                  <CurrencyInput
                    name="referencePrice"
                    value={form.referencePrice}
                    onChange={(raw) => setForm((prev) => ({ ...prev, referencePrice: raw }))}
                    required
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Punto de Reorden (opcional)</label>
                  <input
                    name="reorderPoint"
                    type="number"
                    value={form.reorderPoint}
                    onChange={handleChange}
                    placeholder="Cantidad mínima"
                    className={inputClass}
                  />
                </div>
                <div className="flex items-end gap-6 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      name="perishable"
                      type="checkbox"
                      checked={form.perishable}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-input-border text-graphite focus:ring-graphite/20"
                    />
                    <span className="text-body text-graphite">Perecedero</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      name="active"
                      type="checkbox"
                      checked={form.active}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-input-border text-graphite focus:ring-graphite/20"
                    />
                    <span className="text-body text-graphite">Activo</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Guardando...' : product ? 'Actualizar' : 'Guardar Insumo'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
