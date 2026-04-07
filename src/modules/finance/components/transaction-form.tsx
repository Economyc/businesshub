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
import { financeService } from '../services'
import type { Transaction } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

function toDateString(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface TransactionFormProps {
  open: boolean
  transactionId?: string | null
  onClose: () => void
  onSaved: () => void
}

export function TransactionForm({ open, transactionId, onClose, onSaved }: TransactionFormProps) {
  const { selectedCompany } = useCompany()
  const saveMutation = useFirestoreMutation<any>('transactions', async (companyId, data: any) => {
    if (data._id) {
      await financeService.update(companyId, data._id, data.payload)
    } else {
      await financeService.create(companyId, data.payload)
    }
  })
  const deleteMutation = useFirestoreMutation<string>('transactions', (companyId, id) => financeService.remove(companyId, id), { optimisticDelete: true })
  const [loading, setLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [isLinked, setIsLinked] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)

  const [form, setForm] = useState({
    concept: '',
    category: '',
    amount: '',
    type: 'income' as 'income' | 'expense',
    date: '',
    status: 'pending' as 'paid' | 'pending' | 'overdue',
    notes: '',
  })

  useEffect(() => {
    if (!open) {
      // Reset on close
      setForm({ concept: '', category: '', amount: '', type: 'income', date: '', status: 'pending', notes: '' })
      setIsLinked(false)
      setIsRecurring(false)
      setShowDelete(false)
      return
    }
    if (!transactionId || !selectedCompany) {
      setLoading(false)
      return
    }
    setLoading(true)
    financeService.getById(selectedCompany.id, transactionId).then((tx: Transaction | null) => {
      if (!tx) { onClose(); return }
      if (tx.sourceType === 'closing' || tx.sourceType === 'purchase') setIsLinked(true)
      if (tx.sourceType === 'recurring') setIsRecurring(true)
      setForm({
        concept: tx.concept,
        category: tx.category,
        amount: String(tx.amount),
        type: tx.type,
        date: toDateString(tx.date),
        status: tx.status,
        notes: tx.notes ?? '',
      })
      setLoading(false)
    })
  }, [open, transactionId, selectedCompany?.id])

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
    const payload = {
      concept: form.concept,
      category: form.category,
      amount: Number(form.amount),
      type: form.type,
      date: Timestamp.fromDate(new Date(form.date + 'T12:00:00')),
      status: form.status,
      ...(form.notes ? { notes: form.notes } : {}),
    }
    if (transactionId) {
      await saveMutation.mutateAsync({ _id: transactionId, payload })
    } else {
      await saveMutation.mutateAsync({ payload })
    }
    onSaved()
  }

  async function handleDelete() {
    if (!selectedCompany || !transactionId) return
    await deleteMutation.mutateAsync(transactionId)
    onSaved()
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/25"
              onClick={onClose}
            />

            {/* Modal */}
            <motion.div
              variants={modalVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative bg-surface-elevated rounded-xl shadow-xl border border-border w-full max-w-lg max-h-[min(90vh,fit-content)] overflow-y-auto z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-subheading font-semibold text-dark-graphite">
                  {loading ? 'Cargando...' : isLinked ? 'Transacción Vinculada' : transactionId ? 'Editar Transacción' : 'Nueva Transacción'}
                </h2>
                <div className="flex items-center gap-1">
                  {transactionId && !isLinked && !loading && (
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
              ) : isLinked ? (
                <div className="px-6 pb-6 text-center">
                  <p className="text-body text-graphite mb-4">
                    Esta transacción fue generada automáticamente desde un cierre o compra y no se puede editar directamente.
                  </p>
                  <button onClick={onClose} className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium">
                    Cerrar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="px-6 pb-5">
                  {isRecurring && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-caption text-purple-700">
                      Generada automáticamente desde una transacción recurrente.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Concepto</label>
                      <input
                        name="concept"
                        value={form.concept}
                        onChange={handleChange}
                        required
                        placeholder="Descripción del movimiento"
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
                      <label className={labelClass}>Fecha</label>
                      <DateInput
                        value={form.date}
                        onChange={(v) => setForm((prev) => ({ ...prev, date: v }))}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Estado</label>
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
                  </div>

                  <div className="flex gap-3 mt-5 pt-4 border-t border-border">
                    <button
                      type="submit"
                      disabled={saveMutation.isPending}
                      className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saveMutation.isPending ? 'Guardando...' : transactionId ? 'Guardar Cambios' : 'Guardar Transacción'}
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
        title="Eliminar transacción"
        description={`¿Estás seguro de que deseas eliminar "${form.concept || 'esta transacción'}"? Esta acción no se puede deshacer.`}
      />
    </>
  )
}
