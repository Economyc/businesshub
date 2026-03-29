import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { Trash2 } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateInput } from '@/core/ui/date-input'
import { CategorySelect } from '@/core/ui/category-select'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useCompany } from '@/core/hooks/use-company'
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

export function TransactionForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { selectedCompany } = useCompany()
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(!!id)
  const [showDelete, setShowDelete] = useState(false)
  const [isLinked, setIsLinked] = useState(false)

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
    if (!id || !selectedCompany) return
    setLoading(true)
    financeService.getById(selectedCompany.id, id).then((tx: Transaction | null) => {
      if (!tx) {
        navigate('/finance')
        return
      }
      if (tx.sourceType) {
        setIsLinked(true)
      }
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
  }, [id, selectedCompany?.id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    setSubmitting(true)
    try {
      const data = {
        concept: form.concept,
        category: form.category,
        amount: Number(form.amount),
        type: form.type,
        date: Timestamp.fromDate(new Date(form.date + 'T12:00:00')),
        status: form.status,
        ...(form.notes ? { notes: form.notes } : {}),
      }
      if (id) {
        await financeService.update(selectedCompany.id, id, data)
      } else {
        await financeService.create(selectedCompany.id, data as any)
      }
      navigate('/finance')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!selectedCompany || !id) return
    await financeService.remove(selectedCompany.id, id)
    navigate('/finance')
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      </PageTransition>
    )
  }

  if (isLinked) {
    return (
      <PageTransition>
        <PageHeader title="Transacción Vinculada" />
        <div className="bg-surface rounded-xl card-elevated p-6 text-center">
          <p className="text-body text-graphite mb-4">
            Esta transacción fue generada automáticamente desde un cierre o compra y no se puede editar directamente.
          </p>
          <button
            onClick={() => navigate('/finance')}
            className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium"
          >
            Volver
          </button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader title={id ? 'Editar Transacción' : 'Nueva Transacción'}>
        {id && (
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-red-200 text-red-600 text-body font-medium transition-all duration-200 hover:bg-red-50"
          >
            <Trash2 size={15} strokeWidth={1.5} />
            Eliminar
          </button>
        )}
      </PageHeader>

      <form onSubmit={handleSubmit}>
        <div className="bg-surface rounded-xl card-elevated p-6">
          <div className="grid grid-cols-2 gap-5">
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
            <div className="col-span-2">
              <label className={labelClass}>Notas (opcional)</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Observaciones adicionales..."
                className={`${inputClass} min-h-[80px] resize-none`}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Guardando...' : id ? 'Guardar Cambios' : 'Guardar Transacción'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/finance')}
            className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
          >
            Cancelar
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={showDelete}
        onCancel={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar transacción"
        description="¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer."
      />
    </PageTransition>
  )
}
