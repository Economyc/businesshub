import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, FileText, ImageIcon, FileIcon, Loader2, AlertCircle, Check, Sparkles, ChevronDown } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { Timestamp } from 'firebase/firestore'
import { SelectInput } from '@/core/ui/select-input'
import { DateInput } from '@/core/ui/date-input'
import { modalVariants } from '@/core/animations/variants'
import { getAppFunctions } from '@/core/firebase/config'
import { useCompany } from '@/core/hooks/use-company'
import { queryClient } from '@/core/query/query-client'
import { formatCurrency } from '@/core/utils/format'
import { financeService } from '../services'
import { AiUsageBanner, type AiUsageSnapshot } from './ai-usage-banner'
import type { Transaction, PayableFile, TransactionFormData } from '../types'

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'

interface PaymentUploadDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  pendingInvoices: Transaction[]
}

interface AnalysisResult {
  extracted: {
    supplierName: string
    amount: number
    date: string
    referenceNumber?: string
  }
  suggestion?: {
    invoiceId: string
    docNumber: string
    supplierName: string
    amount: number
    date: string | null
    confidence: 'high' | 'medium' | 'low'
    amountDeltaPct: number
  }
  candidates: Array<{
    invoiceId: string
    docNumber: string
    supplierName: string
    amount: number
    date: string | null
  }>
  extractionFailed?: boolean
  provider?: string
  fallbackUsed?: boolean
  usage?: AiUsageSnapshot
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

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = parseLocalDate(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const cfg = {
    high: { label: 'Alta confianza', bg: 'bg-positive-bg', text: 'text-positive-text' },
    medium: { label: 'Confianza media', bg: 'bg-warning-bg', text: 'text-warning-text' },
    low: { label: 'Baja confianza', bg: 'bg-negative-bg', text: 'text-negative-text' },
  }[level]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

export function PaymentUploadDialog({ open, onClose, onSaved, pendingInvoices }: PaymentUploadDialogProps) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [paidDate, setPaidDate] = useState(todayLocalISO())
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [showAllCandidates, setShowAllCandidates] = useState(false)
  const [docNumberInput, setDocNumberInput] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'uploading' | 'saving' | 'done'>('idle')

  useEffect(() => {
    if (open) {
      setFile(null)
      setPaidDate(todayLocalISO())
      setSelectedInvoiceId('')
      setShowAllCandidates(false)
      setDocNumberInput('')
      setAnalyzing(false)
      setAnalysis(null)
      setAnalyzeError(null)
      setSubmitting(false)
      setError(null)
      setStep('idle')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting && !analyzing) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, submitting, analyzing])

  const runAnalysis = useCallback(async (f: File) => {
    if (!companyId) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalysis(null)
    try {
      const base64 = await fileToBase64(f)
      const fns = await getAppFunctions()
      const analyze = httpsCallable<
        { companyId: string; fileBase64: string; mimeType: string },
        AnalysisResult
      >(fns, 'analyzePaymentReceipt')
      const res = await analyze({ companyId, fileBase64: base64, mimeType: f.type })
      setAnalysis(res.data)
      if (res.data.extractionFailed) {
        setAnalyzeError('No pudimos leer el comprobante con IA — escoge la factura manualmente.')
      } else if (res.data.suggestion) {
        setSelectedInvoiceId(res.data.suggestion.invoiceId)
      }
      // Si la AI extrajo una fecha, pre-llena el campo de pago.
      const extractedDate = res.data.extracted?.date
      if (extractedDate && /^\d{4}-\d{2}-\d{2}$/.test(extractedDate)) {
        setPaidDate(extractedDate)
      }
    } catch (err) {
      setAnalyzeError((err as Error).message ?? 'Error analizando comprobante')
    } finally {
      setAnalyzing(false)
    }
  }, [companyId])

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
    runAnalysis(f)
  }, [runAnalysis])

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

  // Lista de facturas pendientes para el dropdown. Si tenemos análisis,
  // priorizamos los candidatos devueltos por la callable (ya ranqueados);
  // si no, caemos al prop pendingInvoices.
  const dropdownOptions = useMemo(() => {
    if (analysis?.candidates && analysis.candidates.length > 0) {
      return analysis.candidates.map((c) => ({
        value: c.invoiceId,
        label: `${c.supplierName || '—'} · ${c.docNumber || 's/n'} · ${formatCurrency(c.amount, 0)} · ${formatShortDate(c.date)}`,
      }))
    }
    return pendingInvoices.map((t) => ({
      value: t.id,
      label: `${t.payeeRef?.name || '—'} · ${t.docNumber || 's/n'} · ${formatCurrency(t.amount, 0)} · ${formatShortDate(t.date?.toDate?.()?.toISOString().slice(0, 10) ?? null)}`,
    }))
  }, [analysis?.candidates, pendingInvoices])

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null
    return pendingInvoices.find((t) => t.id === selectedInvoiceId) ?? null
  }, [selectedInvoiceId, pendingInvoices])

  // Si la factura seleccionada no tiene # propio (caso típico: facturas hijas
  // de un gasto compartido creadas sin documento), pedimos que el usuario lo
  // tipee aquí. Al guardar, ese # se propaga a la factura.
  const needsDocNumber = !!selectedInvoice && !selectedInvoice.docNumber?.trim()

  // Si el usuario cambia de factura, limpiamos el input — no queremos arrastrar
  // un # de una factura previa a otra.
  useEffect(() => {
    setDocNumberInput('')
  }, [selectedInvoiceId])

  function canSubmit(): boolean {
    if (submitting || !file || !selectedInvoiceId || !paidDate) return false
    if (needsDocNumber && !docNumberInput.trim()) return false
    return true
  }

  async function handleSubmit() {
    if (!canSubmit() || !file || !companyId || !selectedInvoice) return
    setSubmitting(true)
    setError(null)
    try {
      // 1) Subir comprobante a Drive (docType='Pago').
      setStep('uploading')
      const base64 = await fileToBase64(file)
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

      const supplierName = selectedInvoice.payeeRef?.name ?? 'Proveedor'
      const docNumber = (selectedInvoice.docNumber?.trim() || docNumberInput.trim())

      const uploadRes = await upload({
        companyId,
        docType: 'Pago',
        supplierName,
        docNumber,
        date: paidDate,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type,
      })

      // 2) Cruzar con la factura: status='paid', paidDate, paymentProof. Si la
      // factura no tenía # propio (split sin documento), aprovechamos y lo
      // guardamos en el mismo update para que quede registrado.
      setStep('saving')
      const paidTs = Timestamp.fromDate(parseLocalDate(paidDate))
      const paymentProof: PayableFile = {
        driveFileId: uploadRes.data.driveFileId,
        driveWebViewLink: uploadRes.data.webViewLink,
        fileName: uploadRes.data.fileName,
        mimeType: file.type,
        uploadedAt: Timestamp.now(),
      }

      await financeService.update(companyId, selectedInvoice.id, {
        status: 'paid',
        paidDate: paidTs,
        paymentProof,
        ...(needsDocNumber ? { docNumber: docNumberInput.trim() } : {}),
      } as Partial<TransactionFormData>)

      queryClient.invalidateQueries({ queryKey: ['firestore', companyId, 'transactions'] })
      queryClient.invalidateQueries({ queryKey: ['firestore-paginated', companyId, 'transactions'] })
      queryClient.invalidateQueries({ queryKey: ['firestore-count', companyId, 'transactions'] })
      setStep('done')
      setTimeout(() => {
        onSaved()
        onClose()
      }, 600)
    } catch (err) {
      setError((err as Error).message ?? 'Error subiendo pago')
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
        onClick={(e) => { if (e.target === e.currentTarget && !submitting && !analyzing) onClose() }}
      >
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="bg-surface rounded-2xl card-elevated w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-subheading font-medium text-graphite">Subir comprobante de pago</h2>
            <button
              type="button"
              onClick={() => { if (!submitting && !analyzing) onClose() }}
              className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* Drop zone */}
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
                    {isDragging ? 'Suelta el comprobante aquí' : 'Arrastra el comprobante o haz clic'}
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
                    onClick={(e) => { e.stopPropagation(); setFile(null); setAnalysis(null); setSelectedInvoiceId('') }}
                    disabled={submitting || analyzing}
                    className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors disabled:opacity-50"
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>

            {/* Estado de análisis */}
            {analyzing && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-bone/60 border border-border/60 text-caption text-mid-gray">
                <Loader2 size={14} className="animate-spin" />
                Analizando comprobante con IA...
              </div>
            )}

            {analyzeError && !analyzing && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text">
                <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
                <span>No pudimos analizar el archivo: {analyzeError}. Escoge la factura manualmente.</span>
              </div>
            )}

            {analysis?.usage && !analyzing && (
              <AiUsageBanner usage={analysis.usage} provider={analysis.provider} />
            )}

            {/* Sugerencia AI */}
            {analysis?.suggestion && !analyzing && (
              <div className={`p-4 rounded-xl border ${
                analysis.suggestion.invoiceId === selectedInvoiceId
                  ? 'border-graphite bg-bone/40'
                  : 'border-border/60 bg-surface'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} strokeWidth={1.5} className="text-mid-gray" />
                  <span className="text-caption uppercase tracking-wider font-semibold text-mid-gray">Sugerencia IA</span>
                  <ConfidenceBadge level={analysis.suggestion.confidence} />
                </div>
                <div className="text-body text-graphite mb-1">
                  <span className="font-medium">{analysis.suggestion.supplierName || '—'}</span>
                  {' · '}
                  <span className="text-mid-gray">Factura {analysis.suggestion.docNumber || 's/n'}</span>
                </div>
                <div className="flex items-center gap-3 text-caption text-mid-gray mb-3">
                  <span>{formatCurrency(analysis.suggestion.amount, 0)}</span>
                  <span>·</span>
                  <span>{formatShortDate(analysis.suggestion.date)}</span>
                  {analysis.suggestion.amountDeltaPct > 0.01 && (
                    <>
                      <span>·</span>
                      <span className="text-warning-text">
                        Comprobante difiere {(analysis.suggestion.amountDeltaPct * 100).toFixed(1)}% del monto de la factura
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceId(analysis.suggestion!.invoiceId)}
                  disabled={analysis.suggestion.invoiceId === selectedInvoiceId}
                  className={`text-caption font-medium px-3 py-1.5 rounded-md transition-colors ${
                    analysis.suggestion.invoiceId === selectedInvoiceId
                      ? 'bg-bone text-mid-gray cursor-default'
                      : 'bg-graphite text-surface hover:bg-graphite/90'
                  }`}
                >
                  {analysis.suggestion.invoiceId === selectedInvoiceId ? 'Seleccionada' : 'Es esta'}
                </button>
              </div>
            )}

            {/* Override manual */}
            {file && !analyzing && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowAllCandidates((s) => !s)}
                  className="flex items-center gap-1 text-caption text-mid-gray hover:text-graphite transition-colors"
                >
                  <ChevronDown
                    size={14}
                    strokeWidth={1.5}
                    className={`transition-transform ${showAllCandidates ? 'rotate-180' : ''}`}
                  />
                  {analysis?.suggestion ? 'Es otra factura' : 'Escoger factura'}
                </button>
                {(showAllCandidates || !analysis?.suggestion) && (
                  <div className="mt-3">
                    <SelectInput
                      value={selectedInvoiceId}
                      onChange={setSelectedInvoiceId}
                      placeholder="Selecciona factura pendiente"
                      options={[
                        { value: '', label: '— Selecciona —' },
                        ...dropdownOptions,
                      ]}
                    />
                    {dropdownOptions.length === 0 && (
                      <p className="text-caption text-mid-gray mt-2">
                        No hay facturas pendientes para cruzar.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* # Factura — solo si la factura seleccionada no lo tiene */}
            {file && !analyzing && needsDocNumber && (
              <div>
                <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1"># Factura</label>
                <input
                  value={docNumberInput}
                  onChange={(e) => setDocNumberInput(e.target.value)}
                  placeholder="Ej: 8821"
                  className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all"
                />
                <p className="mt-1 text-caption text-mid-gray">
                  Esta factura no tiene número aún. Lo guardamos junto con el comprobante.
                </p>
              </div>
            )}

            {/* Fecha de pago */}
            {file && !analyzing && dropdownOptions.length > 0 && (
              <div>
                <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">Fecha del pago</label>
                <DateInput value={paidDate} onChange={setPaidDate} />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text">
                <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 'uploading' && (
              <div className="flex items-center gap-2 text-caption text-mid-gray">
                <Loader2 size={14} className="animate-spin" />
                Subiendo comprobante a Drive...
              </div>
            )}
            {step === 'saving' && (
              <div className="flex items-center gap-2 text-caption text-mid-gray">
                <Loader2 size={14} className="animate-spin" />
                Cruzando con la factura...
              </div>
            )}
            {step === 'done' && (
              <div className="flex items-center gap-2 text-caption text-positive">
                <Check size={14} strokeWidth={2.5} />
                Pago cruzado — factura marcada como pagada.
              </div>
            )}
          </div>

          <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-border shrink-0">
            <button
              type="button"
              onClick={() => { if (!submitting && !analyzing) onClose() }}
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
              {submitting ? 'Procesando…' : 'Marcar como pagada'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
