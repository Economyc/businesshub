import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileUp, Download, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { modalVariants } from '@/core/animations/variants'
import { parseFile, validateRows, downloadTemplate, type FieldDef, type RowError } from '@/core/utils/data-transfer'

interface Props<T> {
  open: boolean
  onClose: () => void
  title: string
  fields: FieldDef[]
  filenameBase: string
  onImport: (records: T[]) => Promise<{ success: number; failed: number }>
}

type Step = 'upload' | 'preview' | 'result'

export function ImportDialog<T>({ open, onClose, title, fields, filenameBase, onImport }: Props<T>) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [validRows, setValidRows] = useState<T[]>([])
  const [errors, setErrors] = useState<RowError[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)

  useEffect(() => {
    if (open) {
      setStep('upload')
      setFile(null)
      setValidRows([])
      setErrors([])
      setShowErrors(false)
      setImporting(false)
      setResult(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  async function handleFileSelect(f: File) {
    setFile(f)
    try {
      const records = await parseFile(f)
      const { valid, errors: errs } = validateRows<T>(records, fields)
      setValidRows(valid)
      setErrors(errs)
      setStep('preview')
    } catch {
      setErrors([{ row: 0, field: '', message: 'No se pudo leer el archivo. Verifica el formato.' }])
      setValidRows([])
      setStep('preview')
    }
  }

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const res = await onImport(validRows)
      setResult(res)
      setStep('result')
    } catch {
      setResult({ success: 0, failed: validRows.length })
      setStep('result')
    } finally {
      setImporting(false)
    }
  }

  // Build preview headers and rows from valid data
  const previewFields = fields.filter((f) => f.required || ['name', 'identification', 'role', 'department', 'category', 'email'].includes(f.key))
  const previewRows = validRows.slice(0, 15)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-3xl mx-4 border border-border max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h2 className="text-subheading font-semibold text-dark-graphite">{title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Step 1: Upload */}
              {step === 'upload' && (
                <div className="space-y-4">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFileSelect(f)
                    }}
                  />
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const f = e.dataTransfer.files[0]
                      if (f) handleFileSelect(f)
                    }}
                    className="border-2 border-dashed border-mid-gray/30 rounded-xl p-12 text-center cursor-pointer hover:border-graphite/40 hover:bg-card-bg/50 transition-all"
                  >
                    <Upload size={32} strokeWidth={1.5} className="mx-auto mb-3 text-mid-gray/50" />
                    <p className="text-body text-graphite font-medium mb-1">Arrastra un archivo o haz clic para seleccionar</p>
                    <p className="text-caption text-mid-gray">Formatos: Excel (.xlsx) o CSV (.csv)</p>
                  </div>

                  <button
                    onClick={() => downloadTemplate(fields, filenameBase)}
                    className="flex items-center gap-1.5 text-caption text-mid-gray hover:text-graphite transition-colors"
                  >
                    <Download size={13} strokeWidth={1.5} />
                    Descargar plantilla con columnas esperadas
                  </button>
                </div>
              )}

              {/* Step 2: Preview */}
              {step === 'preview' && (
                <div className="space-y-4">
                  <p className="text-body text-graphite">
                    Archivo: <strong>{file?.name}</strong>
                  </p>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <div className="text-caption text-emerald-700">Filas validas</div>
                      <div className="text-body font-semibold text-emerald-800">{validRows.length}</div>
                    </div>
                    {errors.length > 0 && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <div className="text-caption text-amber-700">Errores</div>
                        <div className="text-body font-semibold text-amber-800">{errors.length}</div>
                      </div>
                    )}
                  </div>

                  {/* Errors panel */}
                  {errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <button
                        onClick={() => setShowErrors(!showErrors)}
                        className="flex items-center gap-1.5 text-body text-amber-800 font-medium w-full"
                      >
                        <AlertTriangle size={14} />
                        {errors.length} errores encontrados (filas omitidas)
                        <ChevronRight size={14} className={`ml-auto transition-transform ${showErrors ? 'rotate-90' : ''}`} />
                      </button>
                      {showErrors && (
                        <div className="mt-2 text-caption text-amber-700 space-y-0.5 max-h-32 overflow-y-auto">
                          {errors.slice(0, 20).map((err, i) => (
                            <div key={i}>
                              {err.row > 0 ? `Fila ${err.row}: ` : ''}{err.message}
                            </div>
                          ))}
                          {errors.length > 20 && <div>... y {errors.length - 20} errores mas</div>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preview table */}
                  {validRows.length > 0 && (
                    <div className="overflow-x-auto">
                      <div className="min-w-[500px]">
                        <div
                          className="grid gap-0 text-caption font-medium text-mid-gray uppercase tracking-wider border-b border-border pb-2 mb-2"
                          style={{ gridTemplateColumns: previewFields.map(() => '1fr').join(' ') }}
                        >
                          {previewFields.map((f) => (
                            <div key={f.key}>{f.header}</div>
                          ))}
                        </div>
                        {previewRows.map((row, i) => (
                          <div
                            key={i}
                            className="grid gap-0 text-body py-1.5 border-b border-border/50"
                            style={{ gridTemplateColumns: previewFields.map(() => '1fr').join(' ') }}
                          >
                            {previewFields.map((f) => (
                              <div key={f.key} className="text-graphite truncate pr-2">
                                {String((row as Record<string, unknown>)[f.key] ?? '—')}
                              </div>
                            ))}
                          </div>
                        ))}
                        {validRows.length > 15 && (
                          <div className="text-caption text-mid-gray text-center py-2">
                            ... y {validRows.length - 15} filas mas
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Result */}
              {step === 'result' && result && (
                <div className="text-center py-8 space-y-3">
                  {result.success > 0 ? (
                    <CheckCircle2 size={40} strokeWidth={1.5} className="mx-auto text-emerald-500" />
                  ) : (
                    <AlertTriangle size={40} strokeWidth={1.5} className="mx-auto text-amber-500" />
                  )}
                  <p className="text-subheading font-semibold text-dark-graphite">
                    {result.success > 0 ? 'Importacion completada' : 'Error en la importacion'}
                  </p>
                  <div className="text-body text-graphite space-y-1">
                    {result.success > 0 && <p>{result.success} registros importados correctamente</p>}
                    {result.failed > 0 && <p className="text-amber-600">{result.failed} registros fallaron al guardar</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
              {step === 'preview' && (
                <button
                  onClick={() => setStep('upload')}
                  className="text-body text-graphite hover:text-dark-graphite transition-colors"
                >
                  ← Volver
                </button>
              )}
              <div className="flex items-center gap-3 ml-auto">
                {step !== 'result' && (
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                  >
                    Cancelar
                  </button>
                )}
                {step === 'preview' && validRows.length > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <FileUp size={14} strokeWidth={1.5} />
                    {importing ? 'Importando...' : `Importar ${validRows.length} registros`}
                  </button>
                )}
                {step === 'result' && (
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
