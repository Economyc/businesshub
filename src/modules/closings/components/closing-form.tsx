import { useState, useEffect } from 'react'
import { CurrencyInput } from '@/core/ui/currency-input'
import { DateInput } from '@/core/ui/date-input'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { closingService } from '../services'
import type { Closing } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface ClosingFormProps {
  onSaved: () => void
  editing?: Closing | null
  onCancelEdit?: () => void
}

const emptyForm = {
  date: '',
  ap: '',
  qr: '',
  datafono: '',
  rappiVentas: '',
  efectivo: '',
  propinas: '',
  gastos: '',
  cajaMenor: '',
  entregaEfectivo: '',
  responsable: '',
}

function closingToForm(c: Closing) {
  return {
    date: c.date ?? '',
    ap: c.ap ? String(c.ap) : '',
    qr: c.qr ? String(c.qr) : '',
    datafono: c.datafono ? String(c.datafono) : '',
    rappiVentas: c.rappiVentas ? String(c.rappiVentas) : '',
    efectivo: c.efectivo ? String(c.efectivo) : '',
    propinas: c.propinas ? String(c.propinas) : '',
    gastos: c.gastos ? String(c.gastos) : '',
    cajaMenor: c.cajaMenor ? String(c.cajaMenor) : '',
    entregaEfectivo: c.entregaEfectivo ? String(c.entregaEfectivo) : '',
    responsable: c.responsable ?? '',
  }
}

export function ClosingForm({ onSaved, editing, onCancelEdit }: ClosingFormProps) {
  const [success, setSuccess] = useState(false)

  const createMutation = useFirestoreMutation(
    'closings',
    (companyId, data: any) => closingService.create(companyId, data),
    { invalidate: ['transactions'] },
  )
  const updateMutation = useFirestoreMutation(
    'closings',
    (companyId, data: { id: string; payload: any }) => closingService.update(companyId, data.id, data.payload),
    { invalidate: ['transactions'] },
  )
  const submitting = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState(editing ? closingToForm(editing) : emptyForm)

  useEffect(() => {
    if (editing) setForm(closingToForm(editing))
    else setForm(emptyForm)
  }, [editing])

  function resetForm() {
    setForm(emptyForm)
    onCancelEdit?.()
  }

  const ventaTotal =
    Number(form.qr || 0) +
    Number(form.datafono || 0) +
    Math.max(Number(form.efectivo || 0) - Number(form.ap || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      date: form.date,
      ap: Number(form.ap || 0),
      qr: Number(form.qr || 0),
      datafono: Number(form.datafono || 0),
      rappiVentas: Number(form.rappiVentas || 0),
      efectivo: Number(form.efectivo || 0),
      ventaTotal,
      propinas: Number(form.propinas || 0),
      gastos: Number(form.gastos || 0),
      cajaMenor: Number(form.cajaMenor || 0),
      entregaEfectivo: Number(form.entregaEfectivo || 0),
      responsable: form.responsable,
    }
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    resetForm()
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    onSaved()
  }

  function currencyField(label: string, name: string) {
    return (
      <div>
        <label className={labelClass}>{label}</label>
        <CurrencyInput
          name={name}
          value={form[name as keyof typeof form]}
          onChange={(raw) => setForm((prev) => ({ ...prev, [name]: raw }))}
          placeholder="0"
          className={inputClass}
        />
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl card-elevated p-6">
      <h2 className="text-subheading font-semibold text-dark-graphite mb-5">{editing ? 'Editar Cierre' : 'Registrar Cierre'}</h2>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Fecha</label>
            <DateInput
              value={form.date}
              onChange={(v) => setForm((prev) => ({ ...prev, date: v }))}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Responsable</label>
            <input
              name="responsable"
              value={form.responsable}
              onChange={(e) => setForm((prev) => ({ ...prev, responsable: e.target.value }))}
              required
              placeholder="Nombre del responsable"
              className={inputClass}
            />
          </div>

          {currencyField('AP (Apertura)', 'ap')}
          {currencyField('QR', 'qr')}
          {currencyField('Datáfono', 'datafono')}
          {currencyField('Rappi', 'rappiVentas')}
          {currencyField('Efectivo', 'efectivo')}

          <div>
            <label className={labelClass}>Venta Total</label>
            <div className="px-3 py-2.5 rounded-[10px] border border-input-border bg-bone/50 text-body text-dark-graphite font-semibold">
              ${ventaTotal.toLocaleString('es-CO')}
            </div>
          </div>

          {currencyField('Propinas', 'propinas')}
          {currencyField('Gastos', 'gastos')}
          {currencyField('Caja Menor', 'cajaMenor')}
          {currencyField('Entrega de Efectivo', 'entregaEfectivo')}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
          {success && (
            <span className="text-caption text-green-600 font-medium">{editing ? 'Cierre actualizado' : 'Cierre guardado correctamente'}</span>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Guardando...' : editing ? 'Actualizar Cierre' : 'Guardar Cierre'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
