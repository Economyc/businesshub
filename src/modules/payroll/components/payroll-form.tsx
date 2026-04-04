import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { SelectInput } from '@/core/ui/select-input'
import { modalVariants } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { useCollection } from '@/core/hooks/use-firestore'
import { formatCurrency } from '@/core/utils/format'
import { calculatePayrollItem, calculatePayrollTotals } from '../calculator'
import { usePayrollMutation } from '../hooks'
import { syncPayrollTransaction } from '../transaction-generator'
import { PayrollItemForm } from './payroll-item-form'
import { MONTH_NAMES, type PayrollItem, type PayrollStatus, type OvertimeEntry, type PayrollDeduction } from '../types'
import type { Employee } from '@/modules/talent/types'

const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface PayrollFormProps {
  open: boolean
  onClose: () => void
}

export function PayrollForm({ open, onClose }: PayrollFormProps) {
  const { selectedCompany } = useCompany()
  const { data: employees } = useCollection<Employee>('employees')
  const saveMutation = usePayrollMutation()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [status, setStatus] = useState<PayrollStatus>('draft')
  const [notes, setNotes] = useState('')

  // Per-employee overtime & deductions
  const [employeeOvertime, setEmployeeOvertime] = useState<Record<string, OvertimeEntry[]>>({})
  const [employeeDeductions, setEmployeeDeductions] = useState<Record<string, PayrollDeduction[]>>({})
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'active'),
    [employees],
  )

  const items: PayrollItem[] = useMemo(
    () =>
      activeEmployees.map((emp) =>
        calculatePayrollItem(emp, employeeOvertime[emp.id] ?? [], employeeDeductions[emp.id] ?? []),
      ),
    [activeEmployees, employeeOvertime, employeeDeductions],
  )

  const totals = useMemo(() => calculatePayrollTotals(items), [items])

  useEffect(() => {
    if (open) {
      setYear(now.getFullYear())
      setMonth(now.getMonth())
      setStatus('draft')
      setNotes('')
      setEmployeeOvertime({})
      setEmployeeDeductions({})
      setExpandedEmployee(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany || items.length === 0) return

    const periodLabel = `${MONTH_NAMES[month]} ${year}`
    const data = {
      year,
      month,
      periodLabel,
      status,
      items,
      ...totals,
      notes: notes || undefined,
      transactionCreated: status === 'paid',
    }

    const id = await saveMutation.mutateAsync(data as any)

    if (status === 'paid' && typeof id === 'string') {
      await syncPayrollTransaction(selectedCompany.id, id, data)
    }

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
                Liquidar Nomina
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
                {/* Periodo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Mes</label>
                    <SelectInput
                      value={String(month)}
                      onChange={(v) => setMonth(Number(v))}
                      options={MONTH_NAMES.map((m, i) => ({ value: String(i), label: m }))}
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
                      onChange={(v) => setStatus(v as PayrollStatus)}
                      options={[
                        { value: 'draft', label: 'Borrador' },
                        { value: 'approved', label: 'Aprobada' },
                        { value: 'paid', label: 'Pagada' },
                      ]}
                    />
                  </div>
                </div>

                {/* Empleados */}
                <div>
                  <h3 className="text-caption font-semibold text-dark-graphite mb-3">
                    Empleados Activos ({activeEmployees.length})
                  </h3>

                  {activeEmployees.length === 0 ? (
                    <p className="text-body text-mid-gray py-4">No hay empleados activos.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => {
                        const isExpanded = expandedEmployee === item.employeeId
                        return (
                          <div key={item.employeeId} className="border border-border rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedEmployee(isExpanded ? null : item.employeeId)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-bg transition-colors"
                            >
                              <div className="flex items-center gap-3 text-left">
                                <div>
                                  <span className="text-body font-medium text-dark-graphite">{item.employeeName}</span>
                                  <span className="text-caption text-mid-gray ml-2">{item.employeeRole}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-caption text-mid-gray">Neto</div>
                                  <div className="text-body font-medium text-dark-graphite">{formatCurrency(item.netPay)}</div>
                                </div>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-border bg-card-bg/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 py-3 text-caption">
                                  <div className="flex justify-between">
                                    <span className="text-mid-gray">Salario Base</span>
                                    <span className="text-graphite">{formatCurrency(item.baseSalary)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-mid-gray">Auxilio Transporte</span>
                                    <span className="text-graphite">{formatCurrency(item.auxilioTransporte)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-mid-gray">Horas Extras</span>
                                    <span className="text-graphite">{formatCurrency(item.overtimeTotal)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-mid-gray">Salud (4%)</span>
                                    <span className="text-red-500">-{formatCurrency(item.healthDeduction)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-mid-gray">Pension (4%)</span>
                                    <span className="text-red-500">-{formatCurrency(item.pensionDeduction)}</span>
                                  </div>
                                  {item.additionalDeductions.map((d, i) => (
                                    <div key={i} className="flex justify-between">
                                      <span className="text-mid-gray">{d.concept}</span>
                                      <span className="text-red-500">-{formatCurrency(d.amount)}</span>
                                    </div>
                                  ))}
                                </div>

                                <PayrollItemForm
                                  overtime={employeeOvertime[item.employeeId] ?? []}
                                  deductions={employeeDeductions[item.employeeId] ?? []}
                                  onOvertimeChange={(entries) =>
                                    setEmployeeOvertime((prev) => ({ ...prev, [item.employeeId]: entries }))
                                  }
                                  onDeductionsChange={(deds) =>
                                    setEmployeeDeductions((prev) => ({ ...prev, [item.employeeId]: deds }))
                                  }
                                />
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
                  <div className="bg-card-bg rounded-xl p-4 space-y-2">
                    <h3 className="text-caption font-semibold text-dark-graphite mb-2">Resumen</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-body">
                      <div className="flex justify-between">
                        <span className="text-mid-gray">Total Salarios Base</span>
                        <span className="text-graphite">{formatCurrency(totals.totalBaseSalary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-mid-gray">Total Auxilio Transporte</span>
                        <span className="text-graphite">{formatCurrency(totals.totalAuxilio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-mid-gray">Total Horas Extras</span>
                        <span className="text-graphite">{formatCurrency(totals.totalOvertime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-mid-gray">Total Deducciones</span>
                        <span className="text-red-500">-{formatCurrency(totals.totalDeductions)}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between text-subheading font-semibold">
                      <span className="text-dark-graphite">Neto a Pagar</span>
                      <span className="text-dark-graphite">{formatCurrency(totals.totalNetPay)}</span>
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
                    {saveMutation.isPending ? 'Guardando...' : 'Liquidar Nomina'}
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
