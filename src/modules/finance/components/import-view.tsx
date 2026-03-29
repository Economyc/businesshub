import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { useCompany } from '@/core/hooks/use-company'
import { formatCurrency } from '@/core/utils/format'
import { financeService } from '../services'
import type { TransactionFormData } from '../types'

interface ParsedRow {
  concept: string
  category: string
  amount: number
  type: 'income' | 'expense'
  date: string
  status: 'paid' | 'pending' | 'overdue'
  notes?: string
}

interface RowError {
  row: number
  message: string
}

function validateRow(raw: Record<string, string>, index: number): { data: ParsedRow | null; error: RowError | null } {
  const { concept, amount, type, date, category, status, notes } = raw

  if (!concept?.trim()) {
    return { data: null, error: { row: index + 1, message: 'Falta el campo "concept"' } }
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return { data: null, error: { row: index + 1, message: 'El campo "amount" debe ser un número mayor a 0' } }
  }
  if (type !== 'income' && type !== 'expense') {
    return { data: null, error: { row: index + 1, message: 'El campo "type" debe ser "income" o "expense"' } }
  }
  if (!date?.trim() || isNaN(new Date(date).getTime())) {
    return { data: null, error: { row: index + 1, message: 'El campo "date" no es una fecha válida' } }
  }

  const resolvedStatus: 'paid' | 'pending' | 'overdue' =
    status === 'paid' || status === 'pending' || status === 'overdue' ? status : 'pending'

  return {
    data: {
      concept: concept.trim(),
      category: category?.trim() || 'General',
      amount: Number(amount),
      type,
      date: date.trim(),
      status: resolvedStatus,
      notes: notes?.trim() || undefined,
    },
    error: null,
  }
}

function rawToRows(records: Record<string, string>[]): { valid: ParsedRow[]; errors: RowError[] } {
  const valid: ParsedRow[] = []
  const errors: RowError[] = []

  records.forEach((record, i) => {
    const { data, error } = validateRow(record, i)
    if (data) valid.push(data)
    if (error) errors.push(error)
  })

  return { valid, errors }
}

export function ImportView() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [errors, setErrors] = useState<RowError[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

  function handleFileParse(records: Record<string, string>[]) {
    const { valid, errors: errs } = rawToRows(records)
    setParsedRows(valid)
    setErrors(errs)
    setResult(null)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setResult(null)

    const name = selected.name.toLowerCase()

    if (name.endsWith('.csv')) {
      Papa.parse<Record<string, string>>(selected, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          handleFileParse(results.data as Record<string, string>[])
        },
      })
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buffer = await selected.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
      handleFileParse(rows)
    }
  }

  async function handleImport() {
    if (!selectedCompany || parsedRows.length === 0) return
    setImporting(true)
    let imported = 0
    let failed = 0

    for (const row of parsedRows) {
      try {
        const data: TransactionFormData = {
          concept: row.concept,
          category: row.category,
          amount: row.amount,
          type: row.type,
          date: Timestamp.fromDate(new Date(row.date)),
          status: row.status,
          notes: row.notes,
        }
        await financeService.create(selectedCompany.id, data)
        imported++
      } catch {
        failed++
      }
    }

    setResult({ imported, errors: failed })
    setImporting(false)
  }

  return (
    <PageTransition>
      <PageHeader title="Importar Transacciones">
        <button
          onClick={() => navigate('/finance')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Volver
        </button>
      </PageHeader>

      {/* File Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-input-border rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-graphite/40 hover:bg-card-bg transition-all duration-200 mb-6"
      >
        <Upload size={32} strokeWidth={1.5} className="text-smoke" />
        <div className="text-center">
          <p className="text-body text-graphite font-medium">
            {file ? file.name : 'Arrastra un archivo o haz clic para seleccionar'}
          </p>
          <p className="text-caption text-mid-gray mt-1">Formatos soportados: .csv, .xlsx, .xls</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Parse Stats */}
      {file && (parsedRows.length > 0 || errors.length > 0) && (
        <div className="mb-4">
          <p className="text-body text-graphite">
            <span className="font-medium text-positive-text">{parsedRows.length} filas válidas</span>
            {errors.length > 0 && (
              <>
                {', '}
                <span className="font-medium text-negative-text">{errors.length} errores</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Error List */}
      {errors.length > 0 && (
        <div className="mb-5 bg-negative-bg border border-negative-text/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setErrorsExpanded((v) => !v)}
            className="w-full flex justify-between items-center px-4 py-3 text-negative-text text-body font-medium"
          >
            <span>{errors.length} errores de validación</span>
            {errorsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {errorsExpanded && (
            <div className="border-t border-negative-text/10 px-4 pb-3">
              {errors.map((err) => (
                <div key={err.row} className="flex gap-2 py-1.5 text-caption text-negative-text border-b border-negative-text/10 last:border-b-0">
                  <span className="font-medium">Fila {err.row}:</span>
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div className="mb-5">
          <h2 className="text-subheading font-medium text-dark-graphite mb-3">Vista previa</h2>
          <div className="bg-surface rounded-xl card-elevated overflow-hidden">
            <div
              className="grid px-[18px] py-3 text-caption uppercase tracking-wider text-mid-gray border-b border-border bg-card-bg"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr' }}
            >
              <div>Concepto</div>
              <div>Categoría</div>
              <div>Monto</div>
              <div>Fecha</div>
              <div>Estado</div>
            </div>
            {parsedRows.slice(0, 20).map((row, i) => (
              <div
                key={i}
                className="grid px-[18px] py-3 text-body text-graphite border-b border-bone last:border-b-0 items-center"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr' }}
              >
                <div className="font-medium text-dark-graphite">{row.concept}</div>
                <div>{row.category}</div>
                <div className={row.type === 'income' ? 'text-positive-text' : ''}>
                  {formatCurrency(row.amount, 2)}
                </div>
                <div>{new Date(row.date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-caption font-medium ${
                      row.status === 'paid'
                        ? 'bg-positive-bg text-positive-text'
                        : row.status === 'overdue'
                        ? 'bg-negative-bg text-negative-text'
                        : 'bg-warning-bg text-warning-text'
                    }`}
                  >
                    {row.status === 'paid' ? 'Pagado' : row.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                  </span>
                </div>
              </div>
            ))}
            {parsedRows.length > 20 && (
              <div className="px-[18px] py-3 text-caption text-mid-gray bg-card-bg">
                ... y {parsedRows.length - 20} registros más
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Button */}
      {parsedRows.length > 0 && !result && (
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {importing ? 'Importando...' : `Importar ${parsedRows.length} registros`}
          </button>
        </div>
      )}

      {/* Result Summary */}
      {result && (
        <div className="bg-surface rounded-xl card-elevated p-6 flex flex-col gap-2">
          <h2 className="text-subheading font-medium text-dark-graphite mb-1">Importación completada</h2>
          <p className="text-body text-graphite">
            <span className="font-medium text-positive-text">{result.imported} registros importados</span>
            {result.errors > 0 && (
              <>
                {' · '}
                <span className="font-medium text-negative-text">{result.errors} errores al importar</span>
              </>
            )}
          </p>
          <button
            onClick={() => navigate('/finance')}
            className="mt-3 self-start px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
          >
            Ver transacciones
          </button>
        </div>
      )}
    </PageTransition>
  )
}
