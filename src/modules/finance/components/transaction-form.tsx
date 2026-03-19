import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { useCompany } from '@/core/hooks/use-company'
import { financeService } from '../services'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite placeholder:text-smoke focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

export function TransactionForm() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    concept: '',
    category: '',
    amount: '',
    type: 'income' as 'income' | 'expense',
    date: '',
    status: 'pending' as 'paid' | 'pending' | 'overdue',
    notes: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    setSubmitting(true)
    try {
      await financeService.create(selectedCompany.id, {
        concept: form.concept,
        category: form.category,
        amount: Number(form.amount),
        type: form.type,
        date: Timestamp.fromDate(new Date(form.date)),
        status: form.status,
        notes: form.notes || undefined,
      })
      navigate('/finance')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <PageHeader title="Nueva Transacción" />

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-border p-6">
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
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                placeholder="Ej. Ventas, Nómina, Servicios..."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Monto</label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                required
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <select name="type" value={form.type} onChange={handleChange} className={inputClass}>
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Fecha</label>
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
                <option value="overdue">Vencido</option>
              </select>
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
            className="px-5 py-2.5 rounded-[10px] bg-graphite text-white text-[13px] font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Guardando...' : 'Guardar Transacción'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/finance')}
            className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-[13px] font-medium transition-all duration-200 hover:bg-bone"
          >
            Cancelar
          </button>
        </div>
      </form>
    </PageTransition>
  )
}
