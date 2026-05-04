import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { CurrencyInput } from '@/core/ui/currency-input'
import { SelectInput } from '@/core/ui/select-input'
import { OVERTIME_LABELS, type OvertimeType, type OvertimeEntry, type PayrollDeduction } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface PayrollItemFormProps {
  overtime: OvertimeEntry[]
  deductions: PayrollDeduction[]
  onOvertimeChange: (entries: OvertimeEntry[]) => void
  onDeductionsChange: (deductions: PayrollDeduction[]) => void
}

export function PayrollItemForm({ overtime, deductions, onOvertimeChange, onDeductionsChange }: PayrollItemFormProps) {
  const [newOtType, setNewOtType] = useState<OvertimeType>('diurna')
  const [newOtHours, setNewOtHours] = useState('')

  const [newDedConcept, setNewDedConcept] = useState('')
  const [newDedAmount, setNewDedAmount] = useState('')

  function addOvertime() {
    const hours = Number(newOtHours)
    if (hours <= 0) return
    onOvertimeChange([...overtime, { type: newOtType, hours }])
    setNewOtHours('')
  }

  function removeOvertime(idx: number) {
    onOvertimeChange(overtime.filter((_, i) => i !== idx))
  }

  function addDeduction() {
    const amount = Number(newDedAmount)
    if (!newDedConcept.trim() || amount <= 0) return
    onDeductionsChange([...deductions, { concept: newDedConcept.trim(), amount }])
    setNewDedConcept('')
    setNewDedAmount('')
  }

  function removeDeduction(idx: number) {
    onDeductionsChange(deductions.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-5">
      {/* Horas Extras */}
      <div>
        <h4 className="text-caption font-semibold text-dark-graphite mb-3">Horas Extras</h4>

        {overtime.length > 0 && (
          <div className="space-y-2 mb-3">
            {overtime.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-card-bg rounded-lg text-body">
                <span className="flex-1 text-graphite">{OVERTIME_LABELS[entry.type]}</span>
                <span className="text-mid-gray">{entry.hours}h</span>
                <button
                  type="button"
                  onClick={() => removeOvertime(idx)}
                  className="p-1 rounded text-mid-gray hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className={labelClass}>Tipo</label>
            <SelectInput
              value={newOtType}
              onChange={(v) => setNewOtType(v as OvertimeType)}
              options={Object.entries(OVERTIME_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>
          <div className="w-24">
            <label className={labelClass}>Horas</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={newOtHours}
              onChange={(e) => setNewOtHours(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={addOvertime}
            className="p-2.5 rounded-lg border border-input-border text-graphite hover:bg-bone transition-colors"
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Deducciones Adicionales */}
      <div>
        <h4 className="text-caption font-semibold text-dark-graphite mb-3">Deducciones Adicionales</h4>

        {deductions.length > 0 && (
          <div className="space-y-2 mb-3">
            {deductions.map((ded, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-card-bg rounded-lg text-body">
                <span className="flex-1 text-graphite">{ded.concept}</span>
                <span className="text-mid-gray">${ded.amount.toLocaleString('es-CO')}</span>
                <button
                  type="button"
                  onClick={() => removeDeduction(idx)}
                  className="p-1 rounded text-mid-gray hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className={labelClass}>Concepto</label>
            <input
              type="text"
              value={newDedConcept}
              onChange={(e) => setNewDedConcept(e.target.value)}
              placeholder="Ej: Libranza, Embargo..."
              className={inputClass}
            />
          </div>
          <div className="w-32">
            <label className={labelClass}>Monto</label>
            <CurrencyInput
              name="deduction-amount"
              value={newDedAmount}
              onChange={setNewDedAmount}
              placeholder="0"
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={addDeduction}
            className="p-2.5 rounded-lg border border-input-border text-graphite hover:bg-bone transition-colors"
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
