import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileUp, ChevronRight } from 'lucide-react'
import { SelectInput } from '@/core/ui/select-input'
import { modalVariants } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { formatCurrency } from '@/core/utils/format'
import { parseOFX } from '../utils/parse-ofx'
import { parseBankCSV, guessColumnMapping, type ColumnMapping } from '../utils/parse-bank-csv'
import { autoMatch } from '../utils/reconciliation-matcher'
import { bankStatementService } from '../services'
import { useTransactions } from '../hooks'
import type { BankEntry } from '../types'

const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface Props {
  open: boolean
  onClose: () => void
  onImported: (statementId: string) => void
}

type Step = 'upload' | 'mapping' | 'preview'

export function BankStatementImport({ open, onClose, onImported }: Props) {
  const { selectedCompany } = useCompany()
  const { data: transactions } = useTransactions()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileFormat, setFileFormat] = useState<'csv' | 'ofx'>('csv')
  const [saving, setSaving] = useState(false)

  // CSV-specific state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ date: '', description: '' })

  // Parsed results
  const [entries, setEntries] = useState<BankEntry[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([])

  useEffect(() => {
    if (open) {
      setStep('upload')
      setFile(null)
      setEntries([])
      setParseErrors([])
      setBankName('')
      setAccountNumber('')
      setSaving(false)
    }
  }, [open])

  async function handleFileSelect(f: File) {
    setFile(f)
    const ext = f.name.split('.').pop()?.toLowerCase()

    if (ext === 'ofx' || ext === 'qfx') {
      setFileFormat('ofx')
      const text = await f.text()
      const result = parseOFX(text)
      setEntries(result.entries)
      setPeriodStart(result.periodStart)
      setPeriodEnd(result.periodEnd)
      setBankName(result.bankName ?? '')
      setAccountNumber(result.accountNumber ?? '')
      setParseErrors([])
      setStep('preview')
    } else {
      setFileFormat('csv')
      // Read just headers first
      const text = await f.text()
      const firstLine = text.split('\n')[0]
      const headers = firstLine.split(/[,;\t]/).map((h) => h.trim().replace(/^["']|["']$/g, ''))
      setCsvHeaders(headers)
      const guess = guessColumnMapping(headers)
      setMapping({
        date: guess.date ?? '',
        description: guess.description ?? '',
        amount: guess.amount,
        debit: guess.debit,
        credit: guess.credit,
        reference: guess.reference,
        balance: guess.balance,
      })
      setStep('mapping')
    }
  }

  async function handleMappingConfirm() {
    if (!file) return
    const result = await parseBankCSV(file, mapping)
    setEntries(result.entries)
    setPeriodStart(result.periodStart)
    setPeriodEnd(result.periodEnd)
    setParseErrors(result.errors)
    setStep('preview')
  }

  async function handleImport() {
    if (!selectedCompany || entries.length === 0) return
    setSaving(true)

    try {
      // Run auto-match
      const matchResult = autoMatch(entries, transactions)

      const data = {
        fileName: file?.name ?? 'extracto',
        fileFormat,
        bankName: bankName || undefined,
        accountNumber: accountNumber || undefined,
        periodStart,
        periodEnd,
        entries,
        matches: matchResult.matches,
        status: matchResult.unmatchedBankEntries.length === 0 && matchResult.matches.length > 0
          ? 'reconciled' as const
          : matchResult.matches.length > 0
            ? 'partial' as const
            : 'pending' as const,
        entryCount: entries.length,
        matchedCount: matchResult.matches.length,
        unmatchedBankCount: matchResult.unmatchedBankEntries.length,
        unmatchedTransactionCount: matchResult.unmatchedTransactions.length,
      }

      const id = await bankStatementService.create(selectedCompany.id, data)
      onImported(id)
    } catch (err) {
      console.error('Import error:', err)
    } finally {
      setSaving(false)
    }
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

  const headerOptions = useMemo(
    () => [{ value: '', label: '— No usar —' }, ...csvHeaders.map((h) => ({ value: h, label: h }))],
    [csvHeaders],
  )

  const preview = entries.slice(0, 20)
  const totalCredits = entries.filter((e) => e.type === 'credit').reduce((s, e) => s + e.amount, 0)
  const totalDebits = entries.filter((e) => e.type === 'debit').reduce((s, e) => s + e.amount, 0)

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
              <div className="flex items-center gap-2">
                <h2 className="text-subheading font-semibold text-dark-graphite">
                  Importar Extracto Bancario
                </h2>
                {step !== 'upload' && (
                  <span className="text-caption text-mid-gray">
                    — {step === 'mapping' ? 'Mapeo de columnas' : 'Vista previa'}
                  </span>
                )}
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Step 1: Upload */}
              {step === 'upload' && (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.ofx,.qfx,.xlsx,.xls"
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
                    <p className="text-body text-graphite font-medium mb-1">Arrastra un archivo aqui o haz clic para seleccionar</p>
                    <p className="text-caption text-mid-gray">Formatos: CSV, OFX/QFX</p>
                  </div>
                </div>
              )}

              {/* Step 2: Column Mapping (CSV only) */}
              {step === 'mapping' && (
                <div className="space-y-4">
                  <p className="text-body text-graphite">
                    Archivo: <strong>{file?.name}</strong> — {csvHeaders.length} columnas detectadas
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Fecha *</label>
                      <SelectInput
                        value={mapping.date}
                        onChange={(v) => setMapping((m) => ({ ...m, date: v }))}
                        options={headerOptions}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Descripcion *</label>
                      <SelectInput
                        value={mapping.description}
                        onChange={(v) => setMapping((m) => ({ ...m, description: v }))}
                        options={headerOptions}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Monto (columna unica)</label>
                      <SelectInput
                        value={mapping.amount ?? ''}
                        onChange={(v) => setMapping((m) => ({ ...m, amount: v || undefined }))}
                        options={headerOptions}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Referencia</label>
                      <SelectInput
                        value={mapping.reference ?? ''}
                        onChange={(v) => setMapping((m) => ({ ...m, reference: v || undefined }))}
                        options={headerOptions}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Debito (si columnas separadas)</label>
                      <SelectInput
                        value={mapping.debit ?? ''}
                        onChange={(v) => setMapping((m) => ({ ...m, debit: v || undefined }))}
                        options={headerOptions}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Credito (si columnas separadas)</label>
                      <SelectInput
                        value={mapping.credit ?? ''}
                        onChange={(v) => setMapping((m) => ({ ...m, credit: v || undefined }))}
                        options={headerOptions}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Saldo</label>
                      <SelectInput
                        value={mapping.balance ?? ''}
                        onChange={(v) => setMapping((m) => ({ ...m, balance: v || undefined }))}
                        options={headerOptions}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {step === 'preview' && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-card-bg rounded-lg p-3">
                      <div className="text-caption text-mid-gray">Movimientos</div>
                      <div className="text-body font-semibold text-dark-graphite">{entries.length}</div>
                    </div>
                    <div className="bg-card-bg rounded-lg p-3">
                      <div className="text-caption text-mid-gray">Periodo</div>
                      <div className="text-body font-semibold text-dark-graphite">{periodStart} a {periodEnd}</div>
                    </div>
                    <div className="bg-card-bg rounded-lg p-3">
                      <div className="text-caption text-mid-gray">Total Creditos</div>
                      <div className="text-body font-semibold text-emerald-600">{formatCurrency(totalCredits)}</div>
                    </div>
                    <div className="bg-card-bg rounded-lg p-3">
                      <div className="text-caption text-mid-gray">Total Debitos</div>
                      <div className="text-body font-semibold text-red-500">{formatCurrency(totalDebits)}</div>
                    </div>
                  </div>

                  {/* Errors */}
                  {parseErrors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-body text-amber-800 font-medium mb-1">{parseErrors.length} filas con errores (omitidas)</p>
                      <div className="text-caption text-amber-700 space-y-0.5 max-h-24 overflow-y-auto">
                        {parseErrors.slice(0, 10).map((err, i) => (
                          <div key={i}>Fila {err.row}: {err.message}</div>
                        ))}
                        {parseErrors.length > 10 && <div>... y {parseErrors.length - 10} mas</div>}
                      </div>
                    </div>
                  )}

                  {/* Preview table */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="grid gap-0 text-caption font-medium text-mid-gray uppercase tracking-wider border-b border-border pb-2 mb-2"
                        style={{ gridTemplateColumns: '1fr 2fr 0.8fr 0.8fr' }}
                      >
                        <div>Fecha</div>
                        <div>Descripcion</div>
                        <div className="text-right">Monto</div>
                        <div className="text-right">Tipo</div>
                      </div>
                      {preview.map((entry) => (
                        <div
                          key={entry.id}
                          className="grid gap-0 text-body py-1.5 border-b border-border/50"
                          style={{ gridTemplateColumns: '1fr 2fr 0.8fr 0.8fr' }}
                        >
                          <div className="text-graphite">{entry.date}</div>
                          <div className="text-dark-graphite truncate">{entry.description}</div>
                          <div className={`text-right font-medium ${entry.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {entry.type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {entry.type === 'credit' ? 'Credito' : 'Debito'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {entries.length > 20 && (
                        <div className="text-caption text-mid-gray text-center py-2">
                          ... y {entries.length - 20} movimientos mas
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
              {step === 'mapping' && (
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-body text-graphite hover:text-dark-graphite transition-colors"
                >
                  ← Volver
                </button>
              )}
              {step === 'preview' && fileFormat === 'csv' && (
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="text-body text-graphite hover:text-dark-graphite transition-colors"
                >
                  ← Volver
                </button>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                >
                  Cancelar
                </button>
                {step === 'mapping' && (
                  <button
                    onClick={handleMappingConfirm}
                    disabled={!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit && !mapping.credit)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Vista Previa <ChevronRight size={14} />
                  </button>
                )}
                {step === 'preview' && (
                  <button
                    onClick={handleImport}
                    disabled={saving || entries.length === 0}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <FileUp size={14} strokeWidth={1.5} />
                    {saving ? 'Importando...' : `Importar y Conciliar (${entries.length} mov.)`}
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
