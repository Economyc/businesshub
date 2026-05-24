import { useState, useEffect, useMemo, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, X, FileText, Receipt, Files, Loader2, AlertCircle } from 'lucide-react'
import { DateInput } from '@/core/ui/date-input'
import { CategorySelect } from '@/core/ui/category-select'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { HoverHint } from '@/components/ui/tooltip'
import { modalVariants } from '@/core/animations/variants'
import { getAppFunctions } from '@/core/firebase/config'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { useCollection } from '@/core/hooks/use-firestore'
import { queryClient } from '@/core/query/query-client'
import { financeService } from '../services'
import { StaleDateWarning } from './stale-date-warning'
import { isDateTooOld } from '../utils/date-validation'
import type { Transaction, PayeeRef, PayeeType, PayableFile, TransactionPriority } from '../types'
import type { Supplier } from '@/modules/suppliers/types'

interface NamedEntity { id: string; name: string }

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1'

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
  const [dateConfirmed, setDateConfirmed] = useState(false)
  const [isLinked, setIsLinked] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [isSplit, setIsSplit] = useState(false)

  const [form, setForm] = useState({
    concept: '',
    category: '',
    amount: '',
    type: 'income' as 'income' | 'expense',
    date: '',
    status: 'pending' as 'paid' | 'pending' | 'overdue',
    notes: '',
  })

  const [payeeType, setPayeeType] = useState<PayeeType | ''>('')
  const [payeeId, setPayeeId] = useState('')
  const [payeeExternalName, setPayeeExternalName] = useState('')
  const [priority, setPriority] = useState<TransactionPriority | ''>('')
  const [attachments, setAttachments] = useState<{
    source?: PayableFile
    proof?: PayableFile
    combined?: PayableFile
    docNumber?: string
    documentKind?: 'invoice' | 'purchase'
    payeeName?: string
    paidDate?: Timestamp
  }>({})
  const [combining, setCombining] = useState(false)
  const [combineError, setCombineError] = useState<string | null>(null)

  const { data: partners } = useCollection<NamedEntity>('partners')
  const { data: employees } = useCollection<NamedEntity>('employees')
  const { data: suppliers } = useCollection<Supplier>('suppliers')

  const payeeOptions = useMemo(() => {
    if (payeeType === 'partner') return partners
    if (payeeType === 'employee') return employees
    if (payeeType === 'supplier') return suppliers
    return []
  }, [payeeType, partners, employees, suppliers])

  // Options arrays estables para SelectInput — evitamos crear arrays nuevos
  // en cada render (que disparan re-render de los hijos por identidad).
  const typeOptions = useMemo(() => [
    { value: 'income', label: 'Ingreso' },
    { value: 'expense', label: 'Gasto' },
  ], [])
  const statusOptions = useMemo(() => [
    { value: 'paid', label: 'Pagado' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'overdue', label: 'Vencido' },
  ], [])
  const payeeTypeOptions = useMemo(() => [
    { value: '', label: '— Nadie —' },
    { value: 'partner', label: 'Socio' },
    { value: 'employee', label: 'Empleado' },
    { value: 'supplier', label: 'Proveedor' },
    { value: 'external', label: 'Tercero (externo)' },
  ], [])
  const priorityOptions = useMemo(() => [
    { value: 'waiting', label: 'Espera' },
    { value: 'immediate', label: 'Inmediato' },
  ], [])
  const payeeIdOptions = useMemo(() => [
    { value: '', label: '— Selecciona —' },
    ...[...payeeOptions].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((o) => ({ value: o.id, label: o.name })),
  ], [payeeOptions])

  useEffect(() => {
    if (!open) {
      // Reset on close
      setForm({ concept: '', category: '', amount: '', type: 'income', date: '', status: 'pending', notes: '' })
      setIsLinked(false)
      setIsRecurring(false)
      setIsSplit(false)
      setShowDelete(false)
      setDateConfirmed(false)
      setPayeeType('')
      setPayeeId('')
      setPayeeExternalName('')
      setPriority('')
      setAttachments({})
      setCombining(false)
      setCombineError(null)
      return
    }
    if (!transactionId || !selectedCompany) {
      setLoading(false)
      return
    }
    setLoading(true)
    financeService.getById(selectedCompany.id, transactionId).then((tx: Transaction | null) => {
      if (!tx) { onClose(); return }
      if (tx.sourceType === 'closing') setIsLinked(true)
      if (tx.sourceType === 'recurring') setIsRecurring(true)
      if (tx.splitGroupId) setIsSplit(true)
      setAttachments({
        source: tx.sourceDocument,
        proof: tx.paymentProof,
        combined: tx.combinedDocument,
        docNumber: tx.docNumber,
        documentKind: tx.documentKind,
        payeeName: tx.payeeRef?.name,
        paidDate: tx.paidDate,
      })
      setForm({
        concept: tx.concept,
        category: tx.category,
        amount: String(tx.amount),
        type: tx.type,
        date: toDateString(tx.date),
        status: tx.status,
        notes: tx.notes ?? '',
      })
      if (tx.payeeRef) {
        setPayeeType(tx.payeeRef.type)
        if (tx.payeeRef.type === 'external') {
          setPayeeExternalName(tx.payeeRef.name)
        } else {
          setPayeeId(tx.payeeRef.id)
        }
      }
      setPriority(tx.priority ?? '')
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

  // Si cambia la fecha (solo importa al crear), re-exigir confirmación del aviso.
  useEffect(() => {
    setDateConfirmed(false)
  }, [form.date])

  // Solo avisamos al CREAR; editar una transacción vieja existente no debe molestar.
  const dateBlocked = !transactionId && isDateTooOld(form.date) && !dateConfirmed

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }, [])

  // Setters por campo, estables, para que CategorySelect/SelectInput/DateInput/
  // CurrencyInput no reciban una funcion nueva en cada keystroke (los hijos
  // controlados re-renderizan cuando su prop onChange cambia identidad).
  const setCategory = useCallback((v: string) => setForm((prev) => ({ ...prev, category: v })), [])
  const setAmount = useCallback((raw: string) => setForm((prev) => ({ ...prev, amount: raw })), [])
  const setType = useCallback((v: string) => setForm((prev) => ({ ...prev, type: v as 'income' | 'expense' })), [])
  const setDate = useCallback((v: string) => setForm((prev) => ({ ...prev, date: v })), [])
  const setStatus = useCallback((v: string) => setForm((prev) => ({ ...prev, status: v as 'paid' | 'pending' | 'overdue' })), [])
  const handlePayeeTypeChange = useCallback((v: string) => {
    setPayeeType(v as PayeeType | '')
    setPayeeId('')
    setPayeeExternalName('')
  }, [])
  const handleExternalNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setPayeeExternalName(e.target.value), [])
  const handlePayeeIdChange = useCallback((v: string) => {
    setPayeeId(v)
    if (payeeType === 'supplier' && v) {
      const found = suppliers.find((s) => s.id === v)
      if (found?.category) setCategory(found.category)
    }
  }, [payeeType, suppliers, setCategory])

  // Botón retroactivo: combina factura + comprobante (ya en Drive) en un solo
  // PDF y lo guarda como combinedDocument, sin tocar los originales.
  const handleCombine = useCallback(async () => {
    if (!selectedCompany || !transactionId) return
    const sourceFileId = attachments.source?.driveFileId
    const proofFileId = attachments.proof?.driveFileId
    if (!sourceFileId || !proofFileId) return
    setCombining(true)
    setCombineError(null)
    try {
      const fns = await getAppFunctions()
      const combine = httpsCallable<
        {
          companyId: string
          sourceFileId: string
          proofFileId: string
          supplierName: string
          docNumber: string
          date: string
        },
        { driveFileId: string; webViewLink: string; fileName: string }
      >(fns, 'combineInvoicePaymentToDrive')
      const res = await combine({
        companyId: selectedCompany.id,
        sourceFileId,
        proofFileId,
        supplierName: attachments.payeeName || 'Proveedor',
        docNumber: attachments.docNumber?.trim() || 's-n',
        date: toDateString(attachments.paidDate) || form.date,
      })
      const combinedDocument: PayableFile = {
        driveFileId: res.data.driveFileId,
        driveWebViewLink: res.data.webViewLink,
        fileName: res.data.fileName,
        mimeType: 'application/pdf',
        uploadedAt: Timestamp.now(),
      }
      await financeService.update(selectedCompany.id, transactionId, { combinedDocument } as Partial<Transaction>)
      setAttachments((prev) => ({ ...prev, combined: combinedDocument }))
      queryClient.invalidateQueries({ queryKey: ['firestore', selectedCompany.id, 'transactions'] })
      queryClient.invalidateQueries({ queryKey: ['firestore-paginated', selectedCompany.id, 'transactions'] })
    } catch (err) {
      setCombineError((err as Error).message ?? 'No se pudo generar el PDF combinado')
    } finally {
      setCombining(false)
    }
  }, [selectedCompany, transactionId, attachments, form.date])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany || dateBlocked) return

    let payeeRef: PayeeRef | undefined
    if (payeeType === 'external' && payeeExternalName.trim()) {
      payeeRef = { type: 'external', id: 'external', name: payeeExternalName.trim() }
    } else if (payeeType && payeeType !== 'external' && payeeId) {
      const found = payeeOptions.find((o) => o.id === payeeId)
      if (found) payeeRef = { type: payeeType, id: found.id, name: found.name }
    }

    const payload = {
      concept: form.concept,
      category: form.category,
      amount: Number(form.amount),
      type: form.type,
      date: Timestamp.fromDate(new Date(form.date + 'T12:00:00')),
      status: form.status,
      // Siempre incluir notes (también al limpiar): si quedó vacío, se guarda
      // como string vacío y el display lo lee como "sin nota".
      notes: form.notes.trim(),
      ...(payeeRef ? { payeeRef } : {}),
      ...(attachments.documentKind && priority ? { priority } : {}),
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
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
              className="relative bg-surface-elevated rounded-xl shadow-xl border border-border w-full max-w-lg lg:max-w-xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0 border-b border-border">
                <h2 className="text-subheading font-semibold text-dark-graphite">
                  {loading ? 'Cargando...' : isLinked ? 'Transacción Vinculada' : transactionId ? 'Editar Transacción' : 'Nueva Transacción'}
                </h2>
                <div className="flex items-center gap-1">
                  {transactionId && !isLinked && !loading && (
                    <HoverHint label="Eliminar">
                      <button
                        onClick={() => setShowDelete(true)}
                        className="p-1.5 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </HoverHint>
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
                <div className="space-y-4 px-6 py-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="animate-pulse rounded-md bg-bone/80 h-3 w-16" />
                        <div className="animate-pulse rounded-md bg-bone/80 h-10 w-full rounded-lg" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : isLinked ? (
                <div className="px-6 py-6 text-center overflow-y-auto flex-1">
                  <p className="text-body text-graphite mb-4">
                    Esta transacción fue generada automáticamente desde un cierre o compra y no se puede editar directamente.
                  </p>
                  <button onClick={onClose} className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium">
                    Cerrar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                  <div className="overflow-y-auto px-4 sm:px-6 py-5 flex-1">
                  {isRecurring && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-caption text-purple-700">
                      Generada automáticamente desde una transacción recurrente.
                    </div>
                  )}
                  {isSplit && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-bone border border-border/60 text-caption text-mid-gray">
                      Parte de un gasto compartido entre locales — cada local registra su parte por separado.
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
                        onChange={setCategory}
                        placeholder="Seleccionar categoría"
                        allowCustom
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Monto</label>
                      <CurrencyInput
                        name="amount"
                        value={form.amount}
                        onChange={setAmount}
                        required
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Tipo</label>
                      <SelectInput
                        value={form.type}
                        onChange={setType}
                        options={typeOptions}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Fecha</label>
                      <DateInput
                        value={form.date}
                        onChange={setDate}
                        required
                      />
                    </div>
                    {!transactionId && isDateTooOld(form.date) && (
                      <div className="md:col-span-2">
                        <StaleDateWarning
                          dateISO={form.date}
                          fieldLabel="fecha"
                          confirmed={dateConfirmed}
                          onConfirmChange={setDateConfirmed}
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelClass}>Estado</label>
                      <SelectInput
                        value={form.status}
                        onChange={setStatus}
                        options={statusOptions}
                      />
                    </div>
                    {attachments.documentKind && (
                      <div className="md:col-span-2">
                        <label className={labelClass}>Prioridad</label>
                        <SelectInput
                          value={priority || 'waiting'}
                          onChange={(v) => setPriority(v as TransactionPriority)}
                          options={priorityOptions}
                        />
                      </div>
                    )}
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
                    {(attachments.source || attachments.proof) && (
                      <div className="md:col-span-2 pt-2 border-t border-border/40">
                        <label className={labelClass}>
                          Documentos {attachments.documentKind === 'purchase' ? 'de la compra' : attachments.documentKind === 'invoice' ? 'de la factura' : 'asociados'}
                          {attachments.docNumber && <span className="ml-2 text-mid-gray/70">#{attachments.docNumber}</span>}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {attachments.source && (
                            <a
                              href={attachments.source.driveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-bone hover:bg-bone/70 text-body text-graphite transition-colors"
                              title={attachments.source.fileName}
                            >
                              <FileText size={13} strokeWidth={1.5} />
                              <span className="truncate max-w-[220px]">
                                {attachments.documentKind === 'purchase' ? 'Recibo de compra' : 'Factura'}
                              </span>
                            </a>
                          )}
                          {attachments.proof && (
                            <a
                              href={attachments.proof.driveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-bone hover:bg-bone/70 text-body text-graphite transition-colors"
                              title={attachments.proof.fileName}
                            >
                              <Receipt size={13} strokeWidth={1.5} />
                              <span className="truncate max-w-[220px]">Comprobante de pago</span>
                            </a>
                          )}
                          {attachments.combined && (
                            <a
                              href={attachments.combined.driveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-graphite/60 bg-bone hover:bg-bone/70 text-body text-graphite transition-colors"
                              title={attachments.combined.fileName}
                            >
                              <Files size={13} strokeWidth={1.5} />
                              <span className="truncate max-w-[220px]">PDF combinado</span>
                            </a>
                          )}
                          {/* Botón retroactivo: solo si hay factura + comprobante y aún no hay combinado. */}
                          {attachments.source && attachments.proof && !attachments.combined && (
                            <button
                              type="button"
                              onClick={handleCombine}
                              disabled={combining}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-mid-gray/40 text-body text-mid-gray hover:text-graphite hover:border-graphite/50 transition-colors disabled:opacity-60"
                            >
                              {combining ? <Loader2 size={13} className="animate-spin" /> : <Files size={13} strokeWidth={1.5} />}
                              <span>{combining ? 'Combinando…' : 'Combinar en un PDF'}</span>
                            </button>
                          )}
                        </div>
                        {combineError && (
                          <div className="mt-2 flex items-start gap-2 text-caption text-negative-text">
                            <AlertCircle size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
                            <span>{combineError}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="md:col-span-2 pt-2 border-t border-border/40">
                      <label className={labelClass}>A quién le debemos (opcional)</label>
                      <p className="text-caption text-mid-gray mb-2">
                        Úsalo cuando alguien adelantó esta plata o un proveedor nos vendió a crédito.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <SelectInput
                          value={payeeType}
                          onChange={handlePayeeTypeChange}
                          options={payeeTypeOptions}
                        />
                        {payeeType === 'external' ? (
                          <input
                            value={payeeExternalName}
                            onChange={handleExternalNameChange}
                            placeholder="Nombre del tercero"
                            className={inputClass}
                          />
                        ) : payeeType ? (
                          <SelectInput
                            value={payeeId}
                            onChange={handlePayeeIdChange}
                            options={payeeIdOptions}
                          />
                        ) : (
                          <div />
                        )}
                      </div>
                    </div>
                  </div>

                  </div>
                  <div className="flex gap-3 px-4 sm:px-6 py-4 border-t border-border shrink-0">
                    <button
                      type="submit"
                      disabled={saveMutation.isPending || dateBlocked}
                      className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saveMutation.isPending ? 'Guardando...' : transactionId ? 'Guardar Cambios' : 'Guardar Transacción'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2.5 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
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
