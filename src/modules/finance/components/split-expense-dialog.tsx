import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, Check, Loader2, Split, Upload, FileText, ImageIcon, FileIcon } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { CategorySelect } from '@/core/ui/category-select'
import { CurrencyInput } from '@/core/ui/currency-input'
import { SelectInput } from '@/core/ui/select-input'
import { DateInput } from '@/core/ui/date-input'
import { StaleDateWarning } from './stale-date-warning'
import { isDateTooOld } from '../utils/date-validation'
import { modalVariants } from '@/core/animations/variants'
import { getAppFunctions } from '@/core/firebase/config'
import { useCompany } from '@/core/hooks/use-company'
import { useCollection } from '@/core/hooks/use-firestore'
import { queryClient } from '@/core/query/query-client'
import { formatCurrency } from '@/core/utils/format'
import { generatePendingTransactions } from '../recurring-generator'
import {
  computeSplits,
  createSplitInvoices,
  createRecurringSplitRules,
  makeSplitGroupId,
  makeRecurringSplitGroupId,
  type SplitMode,
} from '../split-service'
import type { PayableFile, PayeeRef, RecurrenceFrequency, TransactionPriority } from '../types'
import type { Supplier } from '@/modules/suppliers/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon
  if (mime === 'application/pdf') return FileText
  return FileIcon
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface SplitExpenseDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all'
const labelClass = 'block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1'

type PayeeKind = 'none' | 'supplier' | 'external'
const CUSTOM_SUPPLIER = '__custom__'

function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return new Date(iso)
  // Anclamos a mediodía para que el mes sea inmune a la zona horaria (el server
  // clasifica el mes de la hoja en hora Bogotá), consistente con transaction-form.
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
}

function invalidateTransactions(companyId: string) {
  queryClient.invalidateQueries({ queryKey: ['firestore', companyId, 'transactions'] })
  queryClient.invalidateQueries({ queryKey: ['firestore-paginated', companyId, 'transactions'] })
  queryClient.invalidateQueries({ queryKey: ['firestore-count', companyId, 'transactions'] })
}

export function SplitExpenseDialog({ open, onClose, onSaved }: SplitExpenseDialogProps) {
  const { companies, selectedCompany } = useCompany()
  const { data: suppliers } = useCollection<Supplier>('suppliers')

  const [concept, setConcept] = useState('')
  const [category, setCategory] = useState('')
  const [payeeKind, setPayeeKind] = useState<PayeeKind>('none')
  const [supplierId, setSupplierId] = useState('')
  const [customSupplier, setCustomSupplier] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [date, setDate] = useState(todayLocalISO())
  const [priority, setPriority] = useState<TransactionPriority>('waiting')
  const [mode, setMode] = useState<SplitMode>('equal')
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [shares, setShares] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly')
  const [startDate, setStartDate] = useState(todayLocalISO())
  const [endDate, setEndDate] = useState('')
  // Un solo estado para confirmar la fecha vieja: es seguro compartirlo entre la
  // fecha única (`date`) y la de inicio recurrente (`startDate`) porque son
  // mutuamente excluyentes vía `isRecurring` (nunca se muestran ambos avisos).
  const [dateConfirmed, setDateConfirmed] = useState(false)

  const [docNumber, setDocNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const [submitting, setSubmitting] = useState(false)
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setConcept('')
    setCategory('')
    setPayeeKind('none')
    setSupplierId('')
    setCustomSupplier('')
    setTotalAmount('')
    setDate(todayLocalISO())
    setPriority('waiting')
    setMode('equal')
    setIncluded(selectedCompany ? { [selectedCompany.id]: true } : {})
    setShares({})
    setNotes('')
    setIsRecurring(false)
    setFrequency('monthly')
    setStartDate(todayLocalISO())
    setEndDate('')
    setDateConfirmed(false)
    setDocNumber('')
    setFile(null)
    setFileError(null)
    setIsDragging(false)
    dragCounter.current = 0
    setSubmitting(false)
    setUploadStep('idle')
    setError(null)
    setDone(false)
  }, [open, selectedCompany?.id])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, submitting])

  // Si cambia la fecha (una vez o inicio del recurrente), re-exigir confirmación.
  useEffect(() => {
    setDateConfirmed(false)
  }, [date, startDate])

  const includedCompanies = useMemo(
    () => companies.filter((c) => included[c.id]),
    [companies, included],
  )

  const total = Number(totalAmount) || 0

  // Preview de cómo queda el reparto. Si computeSplits lanza (no cuadra),
  // guardamos el mensaje para bloquear el submit y mostrarlo.
  const { preview, splitError } = useMemo(() => {
    if (includedCompanies.length < 2 || total <= 0) {
      return { preview: null as Record<string, number> | null, splitError: null as string | null }
    }
    try {
      const result = computeSplits(
        total,
        mode,
        includedCompanies.map((c) => ({
          companyId: c.id,
          amount: Number(shares[c.id]),
          percentage: Number(shares[c.id]),
        })),
      )
      const map: Record<string, number> = {}
      for (const r of result) map[r.companyId] = r.amount
      return { preview: map, splitError: null }
    } catch (err) {
      return { preview: null, splitError: (err as Error).message }
    }
  }, [includedCompanies, total, mode, shares])

  const supplierOptions = useMemo(
    () => [
      { value: '', label: 'Selecciona proveedor' },
      ...[...suppliers].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((s) => ({ value: s.id, label: s.name })),
      { value: CUSTOM_SUPPLIER, label: '+ Otro proveedor' },
    ],
    [suppliers],
  )

  const toggleCompany = useCallback((id: string) => {
    setIncluded((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])
  const setShare = useCallback((id: string, v: string) => {
    setShares((prev) => ({ ...prev, [id]: v }))
  }, [])

  const processFile = useCallback((f: File) => {
    setFileError(null)
    if (f.size > MAX_FILE_SIZE) {
      setFileError('El archivo excede el límite de 10 MB.')
      return
    }
    if (!ACCEPTED_MIMES.includes(f.type)) {
      setFileError('Formato no soportado. Usa PDF, JPG, PNG, WebP, HEIC o HEIF.')
      return
    }
    setFile(f)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [processFile])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current++
    setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0
    const f = e.dataTransfer.files?.[0]
    if (f) processFile(f)
  }, [processFile])

  const conceptOk = concept.trim().length > 0
  const activeDate = isRecurring ? startDate : date
  const dateOk = (isRecurring ? !!startDate : !!date) && (!isDateTooOld(activeDate) || dateConfirmed)
  const payeeOk =
    payeeKind === 'none' ||
    (payeeKind === 'external' && customSupplier.trim().length > 0) ||
    (payeeKind === 'supplier' &&
      (supplierId === CUSTOM_SUPPLIER ? customSupplier.trim().length > 0 : supplierId !== ''))
  const canSubmit =
    !submitting &&
    conceptOk &&
    !!category &&
    total > 0 &&
    includedCompanies.length >= 2 &&
    !splitError &&
    dateOk &&
    payeeOk

  function buildPayeeRef(): PayeeRef | undefined {
    if (payeeKind === 'supplier') {
      if (supplierId === CUSTOM_SUPPLIER) {
        const name = customSupplier.trim()
        return name ? { type: 'external', id: 'external', name } : undefined
      }
      const found = suppliers.find((s) => s.id === supplierId)
      return found ? { type: 'supplier', id: found.id, name: found.name } : undefined
    }
    if (payeeKind === 'external') {
      const name = customSupplier.trim()
      return name ? { type: 'external', id: 'external', name } : undefined
    }
    return undefined
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const entries = computeSplits(
        total,
        mode,
        includedCompanies.map((c) => ({
          companyId: c.id,
          amount: Number(shares[c.id]),
          percentage: Number(shares[c.id]),
        })),
      )
      const payeeRef = buildPayeeRef()
      const trimmedNotes = notes.trim() || undefined
      const trimmedDocNumber = docNumber.trim() || undefined

      if (isRecurring) {
        const startTs = Timestamp.fromDate(parseLocalDate(startDate))
        const endTs = endDate ? Timestamp.fromDate(parseLocalDate(endDate)) : undefined
        setUploadStep('saving')
        const affected = await createRecurringSplitRules({
          entries,
          concept: concept.trim(),
          category,
          frequency,
          startDate: startTs,
          endDate: endTs,
          priority,
          notes: trimmedNotes,
          payeeRef,
          splitGroupId: makeRecurringSplitGroupId(),
        })
        // Generar ya la(s) primera(s) ocurrencia(s) en cada local — si no, sólo
        // aparecerían cuando el usuario entre a ese local (el generador corre
        // por-company al cargar la app).
        for (const cid of affected) {
          await generatePendingTransactions(cid)
          invalidateTransactions(cid)
        }
      } else {
        const dateTs = Timestamp.fromDate(parseLocalDate(date))
        const splitGroupId = makeSplitGroupId()

        // Si hay archivo, subir una copia al Drive de cada local en paralelo
        // antes de escribir las facturas. Si cualquier upload falla, abortamos
        // sin tocar Firestore (los archivos ya subidos quedan huérfanos en
        // Drive, asumido como costo aceptable).
        let sourceDocuments: Record<string, PayableFile> | undefined
        if (file) {
          setUploadStep('uploading')
          const fileBase64 = await fileToBase64(file)
          const fileName = file.name
          const mimeType = file.type
          const supplierName = payeeRef?.name?.trim() || 'Sin proveedor'
          const fns = await getAppFunctions()
          const upload = httpsCallable<
            {
              companyId: string
              docType: 'Factura' | 'Pago' | 'Compra'
              supplierName: string
              docNumber: string
              date: string
              fileBase64: string
              fileName: string
              mimeType: string
            },
            { driveFileId: string; webViewLink: string; fileName: string }
          >(fns, 'uploadDocumentToDrive')
          const uploaded = await Promise.all(
            entries.map(async (entry) => {
              const res = await upload({
                companyId: entry.companyId,
                docType: 'Factura',
                supplierName,
                docNumber: trimmedDocNumber ?? '',
                date,
                fileBase64,
                fileName,
                mimeType,
              })
              const pf: PayableFile = {
                driveFileId: res.data.driveFileId,
                driveWebViewLink: res.data.webViewLink,
                fileName: res.data.fileName,
                mimeType,
                uploadedAt: Timestamp.now(),
              }
              return [entry.companyId, pf] as const
            }),
          )
          sourceDocuments = Object.fromEntries(uploaded)
        }

        setUploadStep('saving')
        const affected = await createSplitInvoices({
          entries,
          concept: concept.trim(),
          category,
          date: dateTs,
          priority,
          splitGroupId,
          notes: trimmedNotes,
          payeeRef,
          docNumber: trimmedDocNumber,
          sourceDocuments,
        })
        for (const cid of affected) invalidateTransactions(cid)
      }

      setDone(true)
      setTimeout(() => { onSaved(); onClose() }, 600)
    } catch (err) {
      setError((err as Error).message ?? 'Error al crear el gasto compartido')
      setSubmitting(false)
      setUploadStep('idle')
    }
  }

  if (!open) return null

  const showSupplierField = payeeKind === 'supplier'
  const showCustomField =
    payeeKind === 'external' || (payeeKind === 'supplier' && supplierId === CUSTOM_SUPPLIER)
  const assignedSum = preview ? Object.values(preview).reduce((s, n) => s + n, 0) : 0

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.15 } }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
      >
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="bg-surface rounded-2xl card-elevated w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-subheading font-medium text-graphite flex items-center gap-2">
              <Split size={16} strokeWidth={1.5} />
              Gasto compartido entre locales
            </h2>
            <button
              type="button"
              onClick={() => { if (!submitting) onClose() }}
              className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            <p className="text-caption text-mid-gray">
              Reparte un gasto entre varios locales. En cada local se crea una factura pendiente por su
              parte, que luego se paga o se cruza con un comprobante.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Concepto</label>
                <input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Salario equipo de mercadeo — mayo"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Categoría</label>
                <CategorySelect value={category} onChange={setCategory} placeholder="Selecciona categoría" allowCustom />
              </div>
              <div>
                <label className={labelClass}>Monto total</label>
                <CurrencyInput value={totalAmount} onChange={setTotalAmount} placeholder="Ej: 3.000.000" className={inputClass} />
              </div>
              {!isRecurring && (
                <div>
                  <label className={labelClass}>Fecha</label>
                  <DateInput value={date} onChange={setDate} />
                </div>
              )}
              {!isRecurring && isDateTooOld(date) && (
                <div className="sm:col-span-2">
                  <StaleDateWarning
                    dateISO={date}
                    fieldLabel="fecha"
                    confirmed={dateConfirmed}
                    onConfirmChange={setDateConfirmed}
                  />
                </div>
              )}
              <div className={isRecurring ? '' : 'sm:col-span-2'}>
                <label className={labelClass}>Prioridad</label>
                <SelectInput
                  value={priority}
                  onChange={(v) => setPriority(v as TransactionPriority)}
                  options={[
                    { value: 'waiting', label: 'Espera' },
                    { value: 'immediate', label: 'Inmediato' },
                  ]}
                />
              </div>
            </div>

            {/* A quién se le paga */}
            <div className="pt-1">
              <label className={labelClass}>A quién se le paga (opcional)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectInput
                  value={payeeKind}
                  onChange={(v) => { setPayeeKind(v as PayeeKind); setSupplierId(''); setCustomSupplier('') }}
                  options={[
                    { value: 'none', label: '— Nadie —' },
                    { value: 'supplier', label: 'Proveedor' },
                    { value: 'external', label: 'Tercero (texto libre)' },
                  ]}
                />
                {showSupplierField && (
                  <SelectInput
                    value={supplierId}
                    onChange={(v) => {
                      setSupplierId(v)
                      if (v !== CUSTOM_SUPPLIER) {
                        setCustomSupplier('')
                        const found = suppliers.find((s) => s.id === v)
                        if (found?.category) setCategory(found.category)
                      }
                    }}
                    options={supplierOptions}
                  />
                )}
                {showCustomField && (
                  <input
                    value={customSupplier}
                    onChange={(e) => setCustomSupplier(e.target.value)}
                    placeholder={payeeKind === 'external' ? 'Ej: Equipo de mercadeo' : 'Nombre del proveedor'}
                    className={inputClass}
                  />
                )}
              </div>
            </div>

            {/* Modo de reparto */}
            <div>
              <label className={labelClass}>Cómo repartir</label>
              <div className="grid grid-cols-3 gap-2 p-1 rounded-lg bg-bone/60 border border-border/60">
                {([
                  { value: 'equal', label: 'Partes iguales' },
                  { value: 'amounts', label: 'Montos' },
                  { value: 'percentages', label: 'Porcentajes' },
                ] as { value: SplitMode; label: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMode(opt.value)}
                    className={`px-3 py-2 rounded-md text-body font-medium transition-colors ${
                      mode === opt.value ? 'bg-surface text-graphite card-elevated' : 'text-mid-gray hover:text-graphite'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Locales */}
            <div>
              <label className={labelClass}>Locales participantes</label>
              <div className="space-y-1.5">
                {companies.map((c) => {
                  const on = !!included[c.id]
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                        on ? 'border-border bg-bone/30' : 'border-border/60'
                      }`}
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleCompany(c.id)}
                          className="rounded border-input-border"
                        />
                        <span className="text-body text-graphite truncate">{c.name}</span>
                      </label>
                      {on && mode !== 'equal' && (
                        <input
                          value={shares[c.id] ?? ''}
                          onChange={(e) => setShare(c.id, e.target.value)}
                          inputMode="numeric"
                          placeholder={mode === 'percentages' ? '%' : 'monto'}
                          className="w-28 px-2 py-1.5 rounded-md border border-input-border bg-input-bg text-body text-graphite text-right outline-none focus:border-input-focus"
                        />
                      )}
                      {on && (
                        <span className="text-caption text-mid-gray tabular-nums w-24 text-right shrink-0">
                          {preview ? formatCurrency(preview[c.id] ?? 0, 0) : '—'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex items-center justify-between text-caption">
                <span className="text-mid-gray">
                  {includedCompanies.length} local{includedCompanies.length === 1 ? '' : 'es'} seleccionado{includedCompanies.length === 1 ? '' : 's'}
                </span>
                {preview && (
                  <span className="text-mid-gray tabular-nums">
                    Asignado {formatCurrency(assignedSum, 0)} / {formatCurrency(total, 0)}
                  </span>
                )}
              </div>
              {splitError && includedCompanies.length >= 2 && total > 0 && (
                <p className="mt-1 text-caption text-negative-text">{splitError}</p>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className={labelClass}>Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Documento — solo en splits puntuales (no recurrentes) */}
            {!isRecurring && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className={labelClass}># Factura (opcional)</label>
                  <input
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="Ej: 8821"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Adjuntar factura (opcional)</label>
                  <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !file && fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-2 px-6 py-6 rounded-xl border-2 border-dashed transition-all duration-200 ${
                      file ? 'border-border bg-bone/30 cursor-default' : 'cursor-pointer'
                    } ${
                      isDragging
                        ? 'border-graphite bg-graphite/5 scale-[1.01]'
                        : !file ? 'border-mid-gray/30 bg-bone/30 hover:border-mid-gray/50 hover:bg-bone/50' : ''
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT_ATTR}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {!file ? (
                      <>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDragging ? 'bg-graphite/10' : 'bg-bone'}`}>
                          <Upload size={18} strokeWidth={1.5} className={isDragging ? 'text-graphite' : 'text-mid-gray'} />
                        </div>
                        <p className="text-body text-graphite">
                          {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo o haz clic para subir'}
                        </p>
                        <p className="text-caption text-mid-gray">PDF, JPG, PNG, WebP, HEIC — máx. 10 MB</p>
                      </>
                    ) : (() => {
                      const FileIconComp = fileIcon(file.type)
                      return (
                        <div className="flex items-center gap-3 w-full">
                          <div className="w-10 h-10 rounded-lg bg-bone flex items-center justify-center shrink-0">
                            <FileIconComp size={18} strokeWidth={1.5} className="text-graphite" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-body text-graphite truncate">{file.name}</p>
                            <p className="text-caption text-mid-gray">{formatBytes(file.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFile(null); setFileError(null) }}
                            disabled={submitting}
                            className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors disabled:opacity-50"
                          >
                            <X size={14} strokeWidth={1.5} />
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                  {fileError && (
                    <p className="mt-1 text-caption text-negative-text">{fileError}</p>
                  )}
                  <p className="mt-1 text-caption text-mid-gray">
                    Se sube una copia al Drive de cada local participante.
                  </p>
                </div>
              </div>
            )}

            {/* Recurrente */}
            <div className="rounded-lg border border-border/60 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-input-border"
                />
                <span className="text-body text-graphite">Repetir periódicamente (ej: salario mensual)</span>
              </label>
              {isRecurring && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className={labelClass}>Frecuencia</label>
                    <SelectInput
                      value={frequency}
                      onChange={(v) => setFrequency(v as RecurrenceFrequency)}
                      options={[
                        { value: 'monthly', label: 'Mensual' },
                        { value: 'weekly', label: 'Semanal' },
                        { value: 'yearly', label: 'Anual' },
                        { value: 'daily', label: 'Diaria' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Inicio</label>
                    <DateInput value={startDate} onChange={setStartDate} />
                  </div>
                  <div>
                    <label className={labelClass}>Fin (opcional)</label>
                    <DateInput value={endDate} onChange={setEndDate} />
                  </div>
                  {isDateTooOld(startDate) && (
                    <div className="sm:col-span-2">
                      <StaleDateWarning
                        dateISO={startDate}
                        fieldLabel="fecha de inicio"
                        confirmed={dateConfirmed}
                        onConfirmChange={setDateConfirmed}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text">
                <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {submitting && !done && (
              <div className="flex items-center gap-2 text-caption text-mid-gray">
                <Loader2 size={14} className="animate-spin" />
                {uploadStep === 'uploading'
                  ? 'Subiendo documento a cada local...'
                  : 'Creando facturas en cada local...'}
              </div>
            )}
            {done && (
              <div className="flex items-center gap-2 text-caption text-positive-text">
                <Check size={14} strokeWidth={2.5} />
                Gasto compartido creado.
              </div>
            )}
          </div>

          <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-border shrink-0">
            <button
              type="button"
              onClick={() => { if (!submitting) onClose() }}
              className="px-4 py-2 rounded-lg text-body font-medium text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Procesando…' : isRecurring ? 'Crear reparto recurrente' : 'Crear gasto compartido'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
