import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { SelectInput } from '@/core/ui/select-input'
import { DateInput } from '@/core/ui/date-input'
import { modalVariants } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { useActiveEmployees } from '@/modules/talent/hooks'
import { formatCurrency } from '@/core/utils/format'
import { calculateSettlementItem, calculateSettlementTotals } from '../calculator'
import { useSettlementMutation } from '../hooks'
import {
  SETTLEMENT_TYPE_LABELS,
  type SettlementType,
  type SettlementStatus,
  type SettlementItem,
} from '../types'

const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

const TYPE_OPTIONS = Object.entries(SETTLEMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

interface SettlementFormProps {
  open: boolean
  onClose: () => void
}

export function SettlementForm({ open, onClose }: SettlementFormProps) {
  const { selectedCompany } = useCompany()
  const { data: activeEmployees } = useActiveEmployees()
  const saveMutation = useSettlementMutation()

  const now = new Date()
  const [type, setType] = useState<SettlementType>('prima_junio')
  const [year, setYear] = useState(now.getFullYear())
  const [status, setStatus] = useState<SettlementStatus>('draft')
  const [notes, setNotes] = useState('')
  const [terminationDate, setTerminationDate] = useState('')
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)


  const termDate = type === 'liquidacion_definitiva' && terminationDate
    ? new Date(terminationDate + 'T12:00:00')
    : undefined

  const allItems: SettlementItem[] = useMemo(
    () => activeEmployees.map((emp) => calculateSettlementItem(emp, type, year, termDate)),
    [activeEmployees, type, year, termDate],
  )

  const items = useMemo(
    () => allItems.filter((item) => !excludedIds.has(item.employeeId)),
    [allItems, excludedIds],
  )

  const totals = useMemo(() => calculateSettlementTotals(items), [items])

  useEffect(() => {
    if (open) {
      setType('prima_junio')
      setYear(now.getFullYear())
      setStatus('draft')
      setNotes('')
      setTerminationDate('')
      setExcludedIds(new Set())
      setExpandedEmployee(null)
    }
  }, [open])

  function toggleEmployee(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany || items.length === 0) return

    const typeLabel = SETTLEMENT_TYPE_LABELS[type]
    const periodLabel = `${typeLabel} ${year}`

    const data = {
      type,
      typeLabel,
      year,
      periodLabel,
      status,
      items,
      ...totals,
      notes: notes || undefined,
      terminationDate: terminationDate || undefined,
    }

    await saveMutation.mutateAsync(data as any)
    onClose()
  }

  function handleCancel() {
    onClose()
  }

  useEffect(() => {
    if (!open) return
    function handleKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') handleCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

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
            className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-3xl mx-4 border border-border max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h2 className="text-subheading font-semibold text-dark-graphite">
                Liquidar Prestaciones Sociales
              </h2>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Tipo y periodo */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-3 sm:col-span-1">
                    <label className={labelClass}>Tipo de Liquidacion</label>
                    <SelectInput
                      value={type}
                      onChange={(v) => setType(v as SettlementType)}
                      options={TYPE_OPTIONS}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Ano</label>
                    <SelectInput
                      value={String(year)}
                      onChange={(v) => setYear(Number(v))}
                      options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Estado</label>
                    <SelectInput
                      value={status}
                      onChange={(v) => setStatus(v as SettlementStatus)}
                      options={[
                        { value: 'draft', label: 'Borrador' },
                        { value: 'approved', label: 'Aprobada' },
                        { value: 'paid', label: 'Pagada' },
                      ]}
                    />
                  </div>
                </div>

                {/* Fecha terminacion (solo liquidacion definitiva) */}
                {type === 'liquidacion_definitiva' && (
                  <div className="max-w-xs">
                    <label className={labelClass}>Fecha de Terminacion</label>
                    <DateInput
                      value={terminationDate}
                      onChange={setTerminationDate}
                    />
                  </div>
                )}

                {/* Empleados */}
                <div>
                  <h3 className="text-caption font-semibold text-dark-graphite mb-3">
                    Empleados ({items.length} de {activeEmployees.length} incluidos)
                  </h3>

                  {activeEmployees.length === 0 ? (
                    <p className="text-body text-mid-gray py-4">No hay empleados activos.</p>
                  ) : (
                    <div className="space-y-2">
                      {allItems.map((item) => {
                        const excluded = excludedIds.has(item.employeeId)
                        const isExpanded = expandedEmployee === item.employeeId
                        return (
                          <div
                            key={item.employeeId}
                            className={`border rounded-xl overflow-hidden transition-colors ${excluded ? 'border-border/50 opacity-50' : 'border-border'}`}
                          >
                            <div className="flex items-center gap-3 px-4 py-3">
                              <input
                                type="checkbox"
                                checked={!excluded}
                                onChange={() => toggleEmployee(item.employeeId)}
                                className="rounded border-mid-gray/40 text-graphite focus:ring-graphite/20 shrink-0"
                              />
                              <button
                                type="button"
                                onClick={() => setExpandedEmployee(isExpanded ? null : item.employeeId)}
                                className="flex-1 flex items-center justify-between hover:bg-card-bg transition-colors rounded-lg -m-1 p-1"
                              >
                                <div className="flex items-center gap-3 text-left">
                                  <div>
                                    <span className="text-body font-medium text-dark-graphite">{item.employeeName}</span>
                                    <span className="text-caption text-mid-gray ml-2">{item.employeeRole}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <div className="text-caption text-mid-gray">Total</div>
                                    <div className="text-body font-medium text-dark-graphite">{formatCurrency(item.totalAmount)}</div>
                                  </div>
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-border bg-card-bg/50">
                                <div className="py-3 space-y-3">
                                  {item.concepts.map((concept, i) => (
                                    <div key={i} className="text-caption">
                                      <div className="flex justify-between font-medium text-graphite mb-0.5">
                                        <span>{concept.label}</span>
                                        <span>{formatCurrency(concept.amount)}</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-mid-gray">
                                        <div className="flex justify-between">
                                          <span>Periodo</span>
                                          <span>{concept.periodStart} a {concept.periodEnd}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Dias</span>
                                          <span>{concept.daysWorked}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Salario Base</span>
                                          <span>{formatCurrency(concept.baseSalary)}</span>
                                        </div>
                                        {concept.auxilioTransporte > 0 && (
                                          <div className="flex justify-between">
                                            <span>Auxilio Transporte</span>
                                            <span>{formatCurrency(concept.auxilioTransporte)}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-mid-gray/70 mt-0.5 italic">{concept.formula}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Totales */}
                {items.length > 0 && (
                  <div className="bg-card-bg rounded-xl p-4">
                    <h3 className="text-caption font-semibold text-dark-graphite mb-2">Resumen</h3>
                    <div className="flex justify-between text-body">
                      <span className="text-mid-gray">Empleados incluidos</span>
                      <span className="text-graphite">{totals.employeeCount}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-border flex justify-between text-subheading font-semibold">
                      <span className="text-dark-graphite">Total a Pagar</span>
                      <span className="text-dark-graphite">{formatCurrency(totals.totalAmount)}</span>
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className={labelClass}>Notas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Observaciones..."
                    className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending || items.length === 0}
                    className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saveMutation.isPending ? 'Guardando...' : 'Liquidar Prestaciones'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
