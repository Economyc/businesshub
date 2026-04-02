import { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalVariants } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { useCompany } from '@/core/hooks/use-company'
import { paymentService } from '../services'
import { PAYMENT_METHODS } from '../types'
import type { CarteraItem } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface PaymentFormProps {
  item: CarteraItem | null
  onClose: () => void
  onSaved: () => void
}

export function PaymentForm({ item, onClose, onSaved }: PaymentFormProps) {
  const { selectedCompany } = useCompany()
  const [amount, setAmount] = useState('')
  const [commission, setCommission] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('transferencia')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  if (!item) return null

  const isRappi = item.type === 'receivable' && item.concept.toLowerCase().includes('rappi')
  const amountNum = parseFloat(amount) || 0
  const commissionNum = parseFloat(commission) || 0
  const totalApplied = amountNum + commissionNum
  const isValid = amountNum > 0 && totalApplied <= item.balance + 0.01

  async function handleSubmit() {
    if (!selectedCompany || !item || !isValid) return
    setSaving(true)
    try {
      await paymentService.create(selectedCompany.id, {
        targetType: item.sourceType,
        targetId: item.id,
        amount: amountNum,
        commission: commissionNum > 0 ? commissionNum : undefined,
        date: Timestamp.fromDate(new Date(date + 'T12:00:00')),
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handlePayFull() {
    if (isRappi) {
      // Can't auto-fill both, just fill amount with balance
      setAmount(item.balance.toString())
      setCommission('0')
    } else {
      setAmount(item.balance.toString())
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/20"
          onClick={saving ? undefined : onClose}
        />
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative bg-surface-elevated rounded-xl p-6 shadow-lg max-w-md w-full mx-4 border border-border"
        >
          <h3 className="text-subheading font-semibold text-dark-graphite mb-1">
            Registrar Pago
          </h3>
          <p className="text-caption text-mid-gray mb-4">
            {item.concept} — Saldo: {formatCurrency(item.balance)}
          </p>

          <div className="space-y-3">
            <div>
              <label className={labelClass}>Monto recibido</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={item.balance.toString()}
                className={inputClass}
                min={0}
                step="any"
              />
            </div>

            {isRappi && (
              <div>
                <label className={labelClass}>Comisión plataforma</label>
                <input
                  type="number"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                  min={0}
                  step="any"
                />
                {commissionNum > 0 && (
                  <p className="text-[11px] text-mid-gray mt-1">
                    Se registrará como gasto "Comisión Rappi" por {formatCurrency(commissionNum)}
                  </p>
                )}
              </div>
            )}

            {totalApplied > 0 && (
              <div className="bg-bone/50 rounded-lg px-3 py-2 text-caption text-graphite">
                Total aplicado al saldo: <strong>{formatCurrency(totalApplied)}</strong>
                {totalApplied < item.balance && (
                  <span className="text-mid-gray"> — Quedará pendiente: {formatCurrency(item.balance - totalApplied)}</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Fecha</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Método</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Referencia</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="No. transferencia, recibo..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas opcionales..."
                rows={2}
                className={inputClass + ' resize-none'}
              />
            </div>
          </div>

          {!isValid && amountNum > 0 && (
            <p className="text-caption text-negative-text mt-2">
              El total aplicado ({formatCurrency(totalApplied)}) no puede superar el saldo ({formatCurrency(item.balance)})
            </p>
          )}

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handlePayFull}
              className="text-caption font-medium text-graphite hover:text-dark-graphite transition-colors"
            >
              Pago total
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-[10px] text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !isValid}
                className="px-4 py-2 rounded-[10px] text-body font-medium btn-primary hover:-translate-y-px hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
