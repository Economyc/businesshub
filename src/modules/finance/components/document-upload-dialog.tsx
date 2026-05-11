import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, FileText, ImageIcon, FileIcon, Loader2, AlertCircle, Check, Sparkles } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { Timestamp } from 'firebase/firestore'
import { CategorySelect } from '@/core/ui/category-select'
import { CurrencyInput } from '@/core/ui/currency-input'
import { SelectInput } from '@/core/ui/select-input'
import { DateInput } from '@/core/ui/date-input'
import { modalVariants } from '@/core/animations/variants'
import { getAppFunctions } from '@/core/firebase/config'
import { useCompany } from '@/core/hooks/use-company'
import { useCollection } from '@/core/hooks/use-firestore'
import { queryClient } from '@/core/query/query-client'
import { financeService } from '../services'
import { generateVirtualInvoicePDF } from '../utils/generate-virtual-invoice-pdf'
import type { DocumentKind, PayableFile, TransactionPriority } from '../types'

type UploadMode = 'file' | 'virtual'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'

interface NamedEntity { id: string; name: string }

interface DocumentUploadDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Tipo por defecto al abrir el dialog. */
  defaultKind?: DocumentKind
}

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

function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return new Date(iso)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function DocumentUploadDialog({ open, onClose, onSaved, defaultKind = 'invoice' }: DocumentUploadDialogProps) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''
  const { data: suppliers } = useCollection<NamedEntity>('suppliers')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const [kind, setKind] = useState<DocumentKind>(defaultKind)
  const [mode, setMode] = useState<UploadMode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [customSupplier, setCustomSupplier] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [date, setDate] = useState(todayLocalISO())
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<TransactionPriority>('waiting')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'uploading' | 'saving' | 'done'>('idle')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiFilled, setAiFilled] = useState(false)

  const CUSTOM = '__custom__'
  const isCustom = supplierId === CUSTOM
  const supplierName = useMemo(() => {
    if (isCustom) return customSupplier.trim()
    return suppliers.find((s) => s.id === supplierId)?.name ?? ''
  }, [suppliers, supplierId, isCustom, customSupplier])

  const supplierOptions = useMemo(
    () => [
      { value: '', label: '— Selecciona proveedor —' },
      ...suppliers.map((s) => ({ value: s.id, label: s.name })),
      { value: CUSTOM, label: '+ Otro Proveedor' },
    ],
    [suppliers],
  )

  useEffect(() => {
    if (open) {
      setKind(defaultKind)
      setMode('file')
      setFile(null)
      setSupplierId('')
      setCustomSupplier('')
      setDocNumber('')
      setDate(todayLocalISO())
      setAmount('')
      setCategory('')
      setNotes('')
      setPriority('waiting')
      setError(null)
      setStep('idle')
      setSubmitting(false)
      setAnalyzing(false)
      setAiFilled(false)
    }
  }, [open, defaultKind])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, submitting])

  const runDocumentAnalysis = useCallback(async (f: File) => {
    if (!companyId) return
    setAnalyzing(true)
    setAiFilled(false)
    try {
      const base64 = await fileToBase64(f)
      const fns = await getAppFunctions()
      const analyze = httpsCallable<
        { companyId: string; fileBase64: string; mimeType: string; kind: DocumentKind },
        {
          extracted: {
            supplierName: string
            docNumber: string
            date: string
            amount: number
            category: string
            notes?: string
          }
          supplierMatch?: { id: string; name: string; score: number }
          categoryExists: boolean
        }
      >(fns, 'analyzeInvoiceDocument')
      const res = await analyze({ companyId, fileBase64: base64, mimeType: f.type, kind })
      const x = res.data.extracted

      // Pre-llenar campos. Si la AI no devolvió algo, no sobreescribir
      // lo que el usuario ya pudo haber tecleado.
      if (res.data.supplierMatch) {
        setSupplierId(res.data.supplierMatch.id)
        setCustomSupplier('')
      } else if (x.supplierName) {
        setSupplierId(CUSTOM)
        setCustomSupplier(x.supplierName)
      }
      if (x.docNumber) setDocNumber(x.docNumber)
      if (x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date)) setDate(x.date)
      if (x.amount > 0) setAmount(String(x.amount))
      if (x.category) setCategory(x.category)
      if (x.notes) setNotes(x.notes)
      setAiFilled(true)
    } catch (err) {
      // El análisis es opcional: si falla, no bloqueamos al usuario.
      console.error('analyzeInvoiceDocument failed', err)
    } finally {
      setAnalyzing(false)
    }
  }, [companyId, kind])

  const processFile = useCallback((f: File) => {
    setError(null)
    if (f.size > MAX_SIZE) {
      setError('El archivo excede el límite de 10 MB.')
      return
    }
    if (!ACCEPTED_MIMES.includes(f.type)) {
      setError('Formato no soportado. Usa PDF, JPG, PNG, WebP, HEIC o HEIF.')
      return
    }
    setFile(f)
    void runDocumentAnalysis(f)
  }, [runDocumentAnalysis])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

  function canSubmit(): boolean {
    const hasSupplier = isCustom ? !!customSupplier.trim() : !!supplierId
    const isVirtual = kind === 'invoice' && mode === 'virtual'
    const hasFile = isVirtual ? true : !!file
    return !submitting && hasFile && hasSupplier && !!docNumber.trim() && !!date && Number(amount) > 0 && !!category
  }

  async function handleSubmit() {
    if (!canSubmit() || !companyId) return
    const isVirtual = kind === 'invoice' && mode === 'virtual'
    if (!isVirtual && !file) return

    setSubmitting(true)
    setError(null)
    try {
      // 1) Preparar archivo:
      //    - file: subida normal, mimeType del archivo original
      //    - virtual: generamos PDF en cliente con jspdf, mimeType pdf
      setStep('uploading')
      let fileBase64: string
      let fileName: string
      let mimeType: string
      if (isVirtual) {
        fileBase64 = await generateVirtualInvoicePDF({
          companyName: selectedCompany?.name ?? 'Empresa',
          supplierName,
          docNumber: docNumber.trim(),
          date,
          amount: Number(amount),
          category,
          notes: notes.trim() || undefined,
        })
        fileName = `Factura virtual - ${supplierName} ${docNumber.trim()}.pdf`
        mimeType = 'application/pdf'
      } else {
        fileBase64 = await fileToBase64(file!)
        fileName = file!.name
        mimeType = file!.type
      }

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

      const docType: 'Factura' | 'Compra' = kind === 'invoice' ? 'Factura' : 'Compra'
      const uploadRes = await upload({
        companyId,
        docType,
        supplierName,
        docNumber: docNumber.trim(),
        date,
        fileBase64,
        fileName,
        mimeType,
      })

      // 2) Crear transaction con sourceDocument.
      setStep('saving')
      const dateTs = Timestamp.fromDate(parseLocalDate(date))
      const sourceDocument: PayableFile = {
        driveFileId: uploadRes.data.driveFileId,
        driveWebViewLink: uploadRes.data.webViewLink,
        fileName: uploadRes.data.fileName,
        mimeType,
        uploadedAt: Timestamp.now(),
      }
      const conceptLabel = `${supplierName} - ${docType} ${docNumber.trim()}${isVirtual ? ' (virtual)' : ''}`

      await financeService.create(companyId, {
        concept: conceptLabel,
        category,
        amount: Number(amount),
        type: 'expense',
        date: dateTs,
        status: kind === 'invoice' ? 'pending' : 'paid',
        notes: notes.trim() || undefined,
        payeeRef: isCustom
          ? { type: 'external', id: '', name: supplierName }
          : { type: 'supplier', id: supplierId, name: supplierName },
        documentKind: kind,
        docNumber: docNumber.trim(),
        sourceDocument,
        ...(kind === 'invoice' ? { priority } : {}),
        ...(kind === 'purchase' ? { paidDate: dateTs } : {}),
      })

      queryClient.invalidateQueries({ queryKey: ['firestore', companyId, 'transactions'] })
      setStep('done')
      setTimeout(() => {
        onSaved()
        onClose()
      }, 600)
    } catch (err) {
      setError((err as Error).message ?? 'Error al subir documento')
      setStep('idle')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const FileIconComp = file ? fileIcon(file.type) : null

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
          className="bg-surface rounded-2xl card-elevated w-full max-w-xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-subheading font-medium text-graphite">
              {kind === 'invoice' && mode === 'virtual' ? 'Crear factura virtual' : 'Subir documento'}
            </h2>
            <button
              type="button"
              onClick={() => { if (!submitting) onClose() }}
              className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Toggle Factura | Compra */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-bone/60 border border-border/60">
              <button
                type="button"
                onClick={() => setKind('invoice')}
                disabled={submitting}
                className={`px-4 py-2 rounded-md text-body font-medium transition-colors ${
                  kind === 'invoice' ? 'bg-surface text-graphite card-elevated' : 'text-mid-gray hover:text-graphite'
                }`}
              >
                Factura / Cuenta de Cobro
              </button>
              <button
                type="button"
                onClick={() => { setKind('purchase'); setMode('file') }}
                disabled={submitting}
                className={`px-4 py-2 rounded-md text-body font-medium transition-colors ${
                  kind === 'purchase' ? 'bg-surface text-graphite card-elevated' : 'text-mid-gray hover:text-graphite'
                }`}
              >
                Compra (al contado)
              </button>
            </div>
            <p className="text-caption text-mid-gray -mt-3">
              {kind === 'invoice'
                ? 'Crea una cuenta por pagar en estado Pendiente. Luego se cruza con un comprobante de pago.'
                : 'Compra ya pagada al momento. Se registra como Pagada directamente.'}
            </p>

            {/* Toggle Archivo | Virtual (solo para facturas) */}
            {kind === 'invoice' && (
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-bone/60 border border-border/60">
                <button
                  type="button"
                  onClick={() => setMode('file')}
                  disabled={submitting}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-body font-medium transition-colors ${
                    mode === 'file' ? 'bg-surface text-graphite card-elevated' : 'text-mid-gray hover:text-graphite'
                  }`}
                >
                  <Upload size={14} strokeWidth={1.5} />
                  Tengo archivo
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('virtual'); setFile(null) }}
                  disabled={submitting}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-body font-medium transition-colors ${
                    mode === 'virtual' ? 'bg-surface text-graphite card-elevated' : 'text-mid-gray hover:text-graphite'
                  }`}
                >
                  <Sparkles size={14} strokeWidth={1.5} />
                  Factura virtual
                </button>
              </div>
            )}
            {kind === 'invoice' && mode === 'virtual' && (
              <p className="text-caption text-mid-gray -mt-3">
                Se genera un PDF placeholder con los datos y se guarda en Drive. Útil cuando se perdió el papel físico.
              </p>
            )}

            {/* Drop zone — solo cuando tenemos archivo real */}
            {mode === 'file' && (
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 px-6 py-7 rounded-xl border-2 border-dashed transition-all duration-200 ${
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
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDragging ? 'bg-graphite/10' : 'bg-bone'}`}>
                    <Upload size={22} strokeWidth={1.5} className={isDragging ? 'text-graphite' : 'text-mid-gray'} />
                  </div>
                  <p className="text-body font-medium text-graphite">
                    {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo o haz clic para subir'}
                  </p>
                  <p className="text-caption text-mid-gray">PDF, JPG, PNG, WebP, HEIC — máx. 10 MB</p>
                </>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-lg bg-bone flex items-center justify-center shrink-0">
                    {FileIconComp && <FileIconComp size={18} strokeWidth={1.5} className="text-graphite" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body text-graphite truncate">{file.name}</p>
                    <p className="text-caption text-mid-gray">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); setAiFilled(false) }}
                    disabled={submitting || analyzing}
                    className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors disabled:opacity-50"
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Estado de análisis IA */}
            {analyzing && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-bone/60 border border-border/60 text-caption text-mid-gray">
                <Loader2 size={14} className="animate-spin" />
                Leyendo el documento con IA...
              </div>
            )}
            {aiFilled && !analyzing && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-positive-bg/50 border border-positive/20 text-caption text-positive-text">
                <Sparkles size={13} strokeWidth={1.5} />
                Campos pre-llenados por IA. Revisa antes de guardar.
              </div>
            )}

            {/* Form fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={isCustom ? 'sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
                <div>
                  <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">Proveedor</label>
                  <SelectInput
                    value={supplierId}
                    onChange={(v) => { setSupplierId(v); if (v !== CUSTOM) setCustomSupplier('') }}
                    options={supplierOptions}
                  />
                </div>
                {isCustom && (
                  <div>
                    <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">Nombre del proveedor</label>
                    <input
                      autoFocus
                      value={customSupplier}
                      onChange={(e) => setCustomSupplier(e.target.value)}
                      placeholder="Ej: Ferretería La 70"
                      className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">
                  {kind === 'invoice' ? '# Factura' : '# Compra'}
                </label>
                <input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder={kind === 'invoice' ? 'Ej: 8821' : 'Ej: 1234'}
                  className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">Fecha</label>
                <DateInput value={date} onChange={setDate} />
              </div>
              <div>
                <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">Valor</label>
                <CurrencyInput value={amount} onChange={setAmount} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">Categoría</label>
                <CategorySelect value={category} onChange={setCategory} placeholder="Selecciona categoría" allowCustom />
              </div>
              {kind === 'invoice' && (
                <div className="sm:col-span-2">
                  <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">Prioridad</label>
                  <SelectInput
                    value={priority}
                    onChange={(v) => setPriority(v as TransactionPriority)}
                    options={[
                      { value: 'waiting', label: 'Espera' },
                      { value: 'immediate', label: 'Inmediato' },
                    ]}
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text">
                <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 'uploading' && (
              <div className="flex items-center gap-2 text-caption text-mid-gray">
                <Loader2 size={14} className="animate-spin" />
                {kind === 'invoice' && mode === 'virtual' ? 'Generando PDF y subiendo a Drive...' : 'Subiendo a Drive...'}
              </div>
            )}
            {step === 'saving' && (
              <div className="flex items-center gap-2 text-caption text-mid-gray">
                <Loader2 size={14} className="animate-spin" />
                Guardando transacción...
              </div>
            )}
            {step === 'done' && (
              <div className="flex items-center gap-2 text-caption text-positive">
                <Check size={14} strokeWidth={2.5} />
                Documento subido y transacción creada.
              </div>
            )}
          </div>

          <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-border">
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
              disabled={!canSubmit()}
              className="px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting
                ? 'Procesando…'
                : kind === 'invoice'
                  ? mode === 'virtual'
                    ? 'Crear factura virtual'
                    : 'Crear factura'
                  : 'Crear compra'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
