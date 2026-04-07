import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, X } from 'lucide-react'
import { DateInput } from '@/core/ui/date-input'
import { CategorySelect } from '@/core/ui/category-select'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { modalVariants } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { recurringService } from '../recurring-service'
import type { RecurringTransaction, RecurrenceFrequency } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

function toDateString(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface RecurringFormProps {
  open: boolean
  recurringId?: string | null
  onClose: () => void
  onSaved: () => void
}

export function RecurringForm({ open, recurringId, onClose, onSaved }: RecurringFormProps) {
  const { selectedCompany } = useCompany()
  const saveMutation = useFirestoreMutation<any>('recurring-transactions', async (companyId, data: any) => {
    if (data._id) {
      await recurringService.update(companyId, data._id, data.payload)
    } else {
      await recurringService.create(companyId, data.payload)
    }
  })
  const deleteMutation = useFirestoreMutation<string>('recurring-transactions', (companyId, id) => recurringService.remove(companyId, id), { optimisticDelete: true })
  const [loading, setLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const [form, setForm] = useState({
    concept: '',
    category: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    status: 'pending' as 'paid' | 'pending' | 'overdue',
    notes: '',
    frequency: 'monthly' as RecurrenceFrequency,
    startDate: '',
    endDate: '',
    isActive: true,
  })

  useEffect(() => {
    if (!open) {
      setForm({ concept: '', category: '', amount: '', type: 'expense', status: 'pending', notes: '', frequency: 'monthly', startDate: '', endDate: '', isActive: true })
      setShowDelete(false)
      return
    }
    if (!recurringId || !selectedCompany) {
      setLoading(false)
      return
    }
    setLoading(true)
    recurringService.getById(selectedCompany.id, recurringId).then((rec: RecurringTransaction | null) => {
      if (!rec) { onClose(); return }
      setForm({
        concept: rec.concept,
        category: rec.category,
        amount: String(rec.amount),
        type: rec.type,
        status: rec.status,
        notes: rec.notes ?? '',
        frequency: rec.frequency,
        startDate: toDateString(rec.startDate),
        endDate: toDateString(rec.endDate),
        isActive: rec.isActive,
      })
      setLoading(false)
    })
  }, [open, recurringId, selectedCompany?.id])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !showDelete) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, showDelete])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    const startDate = Timestamp.fromDate(new Date(form.startDate + 'T12:00:00'))
    const payload = {
      concept: form.concept,
      category: form.category,
      amount: Number(form.amount),
      type: form.type,
      status: form.status,
      frequency: form.frequency,
      startDate,
      nextDueDate: startDate,
      isActive: form.isActive,
      ...(form.notes ? { notes: form.notes } : {}),
      ...(form.endDate ? { endDate: Timestamp.fromDate(new Date(form.endDate + 'T12:00:00')) } : {}),
    }
    if (recurringId) {
      await saveMutation.mutateAsync({ _id: recurringId, payload })
    } else {
      await saveMutation.mutateAsync({ payload })
    }
    onSaved()
  }

  async function handleDelete() {
    if (!selectedCompany || !recurringId) return
    await deleteMutation.mutateAsync(recurringId)
    onSaved()
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] md:pt-[8vh] p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/25"
              onClick={onClose}
            />

            <motion.div
              variants={modalVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative bg-surface-elevated rounded-xl shadow-xl border border-border w-full max-w-lg max-h-[min(90vh,fit-content)] overflow-y-auto z-10"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-subheading font-semibold text-dark-graphite">
                  {loading ? 'Cargando...' : recurringId ? 'Editar Recurrente' : 'Nueva Recurrente'}
                </h2>
                <div className="flex items-center gap-1">
                  {recurringId && !loading && (
                    <button
                      onClick={() => setShowDelete(true)}
                      className="p-1.5 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                      title="Eliminar"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="space-y-4 px-6 py-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="animate-pulse rounded-md bg-bone/80 h-3 w-16" />
                        <div className="animate-pulse rounded-md bg-bone/80 h-10 w-full rounded-[10px]" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="px-6 pb-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Concepto</label>
                      <input
                        name="concept"
                        value={form.concept}
                        onChange={handleChange}
                        required
                        placeholder="Ej: Arriendo local"
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
                      <label className={labelClass}>Monto</label>
                      <CurrencyInput
                        name="amount"
                        value={form.amount}
                        onChange={(raw) => setForm((prev) => ({ ...prev, amount: raw }))}
                        required
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Tipo</label>
                      <SelectInput
                        value={form.type}
                        onChange={(v) => setForm((prev) => ({ ...prev, type: v as 'income' | 'expense' }))}
                        options={[
                          { value: 'income', label: 'Ingreso' },
                          { value: 'expense', label: 'Gasto' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Frecuencia</label>
                      <SelectInput
                        value={form.frequency}
                        onChange={(v) => setForm((prev) => ({ ...prev, frequency: v as RecurrenceFrequency }))}
                        options={[
                          { value: 'daily', label: 'Diario' },
                          { value: 'weekly', label: 'Semanal' },
                          { value: 'monthly', label: 'Mensual' },
                          { value: 'yearly', label: 'Anual' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Estado al generar</label>
                      <SelectInput
                        value={form.status}
                        onChange={(v) => setForm((prev) => ({ ...prev, status: v as 'paid' | 'pending' | 'overdue' }))}
                        options={[
                          { value: 'paid', label: 'Pagado' },
                          { value: 'pending', label: 'Pendiente' },
                          { value: 'overdue', label: 'Vencido' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Fecha inicio</label>
                      <DateInput
                        value={form.startDate}
                        onChange={(v) => setForm((prev) => ({ ...prev, startDate: v }))}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Fecha fin (opcional)</label>
                      <DateInput
                        value={form.endDate}
                        onChange={(v) => setForm((prev) => ({ ...prev, endDate: v }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Notas (opcional)</label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        placeholder="Observaciones adicionales..."
                        className={`${inputClass} min-h-[70px] resize-none`}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                        className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${form.isActive ? 'bg-graphite' : 'bg-mid-gray/30'}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200 ${form.isActive ? 'translate-x-[18px]' : ''}`}
                        />
                      </button>
                      <span className="text-body text-graphite">{form.isActive ? 'Activa' : 'Pausada'}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-5 pt-4 border-t border-border">
                    <button
                      type="submit"
                      disabled={saveMutation.isPending}
                      className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saveMutation.isPending ? 'Guardando...' : recurringId ? 'Guardar Cambios' : 'Crear Recurrente'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showDelete}
        onCancel={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar recurrente"
        description={`¿Estás seguro de que deseas eliminar "${form.concept || 'esta recurrente'}"? Las transacciones ya generadas no se eliminarán.`}
      />
    </>
  )
}
