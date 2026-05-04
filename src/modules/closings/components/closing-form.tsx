import { useState, useEffect } from 'react'
import { CurrencyInput } from '@/core/ui/currency-input'
import { DateInput } from '@/core/ui/date-input'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { closingService } from '../services'
import type { Closing } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface ClosingFormProps {
  onSaved: () => void
  editing?: Closing | null
  onCancelEdit?: () => void
}

const emptyForm = {
  date: '',
  ap: '500000',
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Card: Datos de Cierre */}
      <div className="bg-surface rounded-2xl card-elevated p-4 sm:p-6">
        <h2 className="text-caption font-extrabold uppercase tracking-widest text-mid-gray mb-4">
          {editing ? 'Editar Cierre' : 'Datos de Cierre'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* Card: Desglose de Ventas */}
      <div className="bg-surface rounded-2xl card-elevated p-4 sm:p-6">
        <h2 className="text-caption font-extrabold uppercase tracking-widest text-mid-gray mb-4">
          Desglose de Ventas
        </h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {currencyField('AP (Apertura)', 'ap')}
          {currencyField('QR', 'qr')}
          {currencyField('Datáfono', 'datafono')}
          {currencyField('Rappi', 'rappiVentas')}
          <div className="col-span-2">
            {currencyField('Efectivo en Caja', 'efectivo')}
          </div>
        </div>

        {/* Venta Total - highlighted result */}
        <div className="mt-4 p-4 rounded-xl bg-positive-bg">
          <span className="block text-caption font-medium text-positive-text uppercase mb-1">Venta Total</span>
          <div className="flex items-baseline gap-1">
            <span className="text-positive-text text-subheading font-semibold">$</span>
            <span className="text-positive-text text-kpi font-semibold tracking-tight">{ventaTotal.toLocaleString('es-CO')}</span>
          </div>
        </div>
      </div>

      {/* Card: Otros Movimientos */}
      <div className="bg-surface rounded-2xl card-elevated p-4 sm:p-6">
        <h2 className="text-caption font-extrabold uppercase tracking-widest text-mid-gray mb-4">
          Otros Movimientos
        </h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {currencyField('Propinas', 'propinas')}
          {currencyField('Caja Menor', 'cajaMenor')}
          <div className="col-span-2">
            {currencyField('Gastos', 'gastos')}
          </div>
          <div className="col-span-2">
            {currencyField('Entrega de Efectivo', 'entregaEfectivo')}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {success && (
          <span className="text-caption text-green-600 font-medium">{editing ? 'Cierre actualizado' : 'Cierre guardado correctamente'}</span>
        )}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto sm:ml-auto">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl btn-primary text-body font-bold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Guardando...' : editing ? 'Actualizar Cierre' : 'Guardar Cierre'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-mid-gray text-body font-bold transition-all duration-200 hover:bg-bone"
          >
            Limpiar
          </button>
        </div>
      </div>
    </form>
  )
}
