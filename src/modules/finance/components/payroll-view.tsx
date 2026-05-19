import { useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  X,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  Users,
} from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { CurrencyInput } from '@/core/ui/currency-input'
import { SelectInput } from '@/core/ui/select-input'
import { DateInput } from '@/core/ui/date-input'
import { useCompany } from '@/core/hooks/use-company'
import { useCollection } from '@/core/hooks/use-firestore'
import { usePermissions } from '@/core/hooks/use-permissions'
import { formatCurrency } from '@/core/utils/format'
import type { Employee } from '@/modules/talent/types'
import {
  analyzeColilla,
  analyzePropinas,
  matchEmployee,
  mapWithConcurrency,
  registerPayrollBatch,
  registerTipDistribution,
} from '../payroll-service'
import type { PayrollRowState, TipRowState } from '../types-payroll'

const MAX_SIZE = 10 * 1024 * 1024
const COLILLA_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'
const PROPINAS_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.csv,.xlsx,.xls'
const ANALYZE_CONCURRENCY = 3

type Tab = 'nomina' | 'propinas'

let _uid = 0
function uid(): string {
  _uid += 1
  return `r${Date.now()}_${_uid}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseISO(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return new Date(iso)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function slugPeriod(label: string, fallbackISO: string): string {
  const s = (label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return s || fallbackISO
}

export function PayrollView() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''
  const { data: employees } = useCollection<Employee>('employees')
  const { can } = usePermissions()
  const canEdit = can('finance', 'create')

  const [tab, setTab] = useState<Tab>('nomina')
  const [periodLabel, setPeriodLabel] = useState('')
  const [paidDate, setPaidDate] = useState(todayISO())

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'Sin asignar' },
      ...[...employees]
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((e) => ({ value: e.id, label: e.name })),
    ],
    [employees],
  )

  // La clave del periodo SIEMPRE incluye la fecha de pago: así dos lotes con la
  // misma etiqueta pero distinta fecha NO colisionan (registrar reemplaza solo
  // el lote del mismo periodo+fecha exactos).
  const periodKey = `${slugPeriod(periodLabel, 'p')}__${paidDate}`
  const effectiveLabel = periodLabel.trim() || `Quincena ${paidDate}`

  return (
    <PageTransition>
      <PageHeader title="Nómina y Propinas">
        <button
          onClick={() => navigate('/finance')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Volver
        </button>
      </PageHeader>

      {!canEdit && (
        <div className="mb-6 flex items-start gap-2 px-4 py-3 rounded-lg bg-warning-bg/50 border border-warning/20 text-caption text-warning-text">
          <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>No tienes permiso para registrar en Contabilidad. Puedes revisar pero no confirmar.</span>
        </div>
      )}

      {/* Periodo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">
            Etiqueta del periodo
          </label>
          <input
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="Ej: Q1 mayo 2026"
            className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">
            Fecha de pago
          </label>
          <DateInput value={paidDate} onChange={setPaidDate} />
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-bone/60 border border-border/60 mb-6 max-w-md">
        <button
          type="button"
          onClick={() => setTab('nomina')}
          className={`px-4 py-2 rounded-lg text-body font-medium transition-colors ${
            tab === 'nomina' ? 'bg-surface text-graphite card-elevated' : 'text-mid-gray hover:text-graphite'
          }`}
        >
          Nómina
        </button>
        <button
          type="button"
          onClick={() => setTab('propinas')}
          className={`px-4 py-2 rounded-lg text-body font-medium transition-colors ${
            tab === 'propinas' ? 'bg-surface text-graphite card-elevated' : 'text-mid-gray hover:text-graphite'
          }`}
        >
          Propinas
        </button>
      </div>

      {tab === 'nomina' ? (
        <NominaTab
          companyId={companyId}
          employees={employees}
          employeeOptions={employeeOptions}
          canEdit={canEdit}
          periodKey={periodKey}
          periodLabel={effectiveLabel}
          paidDate={parseISO(paidDate)}
        />
      ) : (
        <PropinasTab
          companyId={companyId}
          employees={employees}
          employeeOptions={employeeOptions}
          canEdit={canEdit}
          periodKey={periodKey}
          periodLabel={effectiveLabel}
          paidDate={parseISO(paidDate)}
        />
      )}
    </PageTransition>
  )
}

interface TabProps {
  companyId: string
  employees: Employee[]
  employeeOptions: { value: string; label: string }[]
  canEdit: boolean
  periodKey: string
  periodLabel: string
  paidDate: Date
}

function Dropzone({
  multiple,
  accept,
  onFiles,
  disabled,
}: {
  multiple: boolean
  accept: string
  onFiles: (files: File[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const pick = useCallback(
    (list: FileList | null) => {
      if (!list) return
      const files = Array.from(list).filter((f) => {
        if (f.size > MAX_SIZE) return false
        return true
      })
      if (files.length) onFiles(multiple ? files : [files[0]])
    },
    [multiple, onFiles],
  )

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (!disabled) pick(e.dataTransfer.files)
      }}
      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
        disabled
          ? 'opacity-60 cursor-not-allowed border-mid-gray/30'
          : 'cursor-pointer ' +
            (drag
              ? 'border-graphite bg-graphite/5'
              : 'border-mid-gray/30 bg-bone/30 hover:border-mid-gray/50 hover:bg-bone/50')
      }`}
    >
      <Upload size={28} strokeWidth={1.5} className="text-mid-gray" />
      <p className="text-body font-medium text-graphite text-center">
        {multiple
          ? 'Arrastra las colillas o haz clic para subir varias'
          : 'Arrastra el archivo de propinas o haz clic para subir'}
      </p>
      <p className="text-caption text-mid-gray">
        {multiple ? 'PDF o imagen' : 'PDF, imagen o Excel/CSV'} — máx. 10 MB c/u
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          pick(e.target.files)
          if (inputRef.current) inputRef.current.value = ''
        }}
        className="hidden"
      />
    </div>
  )
}

function NominaTab({
  companyId,
  employees,
  employeeOptions,
  canEdit,
  periodKey,
  periodLabel,
  paidDate,
}: TabProps) {
  const [files, setFiles] = useState<File[]>([])
  const [rows, setRows] = useState<PayrollRowState[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ registered: number; failed: { employeeName: string; error: string }[] } | null>(
    null,
  )

  const addFiles = useCallback((picked: File[]) => {
    setFiles((prev) => [...prev, ...picked])
    setResult(null)
    setError(null)
  }, [])

  async function handleAnalyze() {
    if (!companyId || files.length === 0) return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: files.length })
    try {
      let done = 0
      const newRows = await mapWithConcurrency(files, ANALYZE_CONCURRENCY, async (file) => {
        try {
          const res = await analyzeColilla(companyId, file)
          done += 1
          setProgress({ done, total: files.length })
          const x = res.extracted
          const match = res.extractionFailed
            ? null
            : matchEmployee(employees, x.employeeName, x.identification)
          const row: PayrollRowState = {
            rowId: uid(),
            file,
            extracted: x,
            employeeId: match?.id ?? '',
            employeeName: match?.name ?? x.employeeName,
            amountToPost: Math.round(x.totalDevengado || x.netoCancelado || 0),
            include: !res.extractionFailed,
            analyzeStatus: res.extractionFailed ? 'failed' : 'done',
            provider: res.provider,
          }
          return row
        } catch {
          // Un archivo corrupto/no leíble no debe abortar todo el lote.
          done += 1
          setProgress({ done, total: files.length })
          return {
            rowId: uid(),
            file,
            extracted: {
              employeeName: '',
              identification: '',
              role: '',
              payPeriod: '',
              totalDevengado: 0,
              totalDeducciones: 0,
              netoCancelado: 0,
            },
            employeeId: '',
            employeeName: '',
            amountToPost: 0,
            include: false,
            analyzeStatus: 'failed' as const,
          } satisfies PayrollRowState
        }
      })
      setRows((prev) => [...prev, ...newRows])
      setFiles([])
    } catch (e) {
      setError((e as Error).message ?? 'Error al procesar con IA')
    } finally {
      setAnalyzing(false)
    }
  }

  function patchRow(rowId: string, patch: Partial<PayrollRowState>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)))
  }

  const includedCount = rows.filter((r) => r.include && r.employeeId && r.amountToPost > 0).length
  const totalToPost = rows
    .filter((r) => r.include && r.employeeId && r.amountToPost > 0)
    .reduce((s, r) => s + r.amountToPost, 0)

  async function handleSubmit() {
    if (!canEdit || includedCount === 0) return
    if (!companyId) {
      setError('Selecciona una empresa antes de registrar.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await registerPayrollBatch(companyId, { periodKey, periodLabel, paidDate, rows })
      setResult(res)
      if (res.failed.length === 0) setRows([])
    } catch (e) {
      setError((e as Error).message ?? 'Error al registrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Dropzone multiple accept={COLILLA_ACCEPT} onFiles={addFiles} disabled={analyzing || submitting} />

      {files.length > 0 && (
        <div className="bg-surface rounded-xl card-elevated p-4 space-y-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-3">
              <FileText size={16} strokeWidth={1.5} className="text-mid-gray shrink-0" />
              <span className="text-body text-graphite truncate flex-1">{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="p-1 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !companyId}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Procesando {progress.done}/{progress.total}…
              </>
            ) : (
              <>
                <Sparkles size={15} strokeWidth={1.5} />
                Procesar con IA ({files.length})
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text">
          <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-subheading font-medium text-dark-graphite">
              Revisión ({rows.length} colillas)
            </h2>
            <p className="text-caption text-mid-gray">
              El valor a registrar usa el Total Devengado (costo real). Edítalo si aplica.
            </p>
          </div>
          <div className="bg-surface rounded-xl card-elevated overflow-x-auto">
            <div
              className="grid min-w-[900px] px-4 py-3 text-caption uppercase tracking-wider font-semibold text-mid-gray border-b border-border bg-card-bg"
              style={{ gridTemplateColumns: '0.4fr 2fr 1fr 1fr 1fr 1.4fr 0.6fr' }}
            >
              <div>Incluir</div>
              <div>Empleado</div>
              <div className="text-right">Devengado</div>
              <div className="text-right">Deduc.</div>
              <div className="text-right">Neto</div>
              <div className="text-right">Valor a registrar</div>
              <div></div>
            </div>
            {rows.map((row) => {
              const noMatch = !row.employeeId
              return (
                <div
                  key={row.rowId}
                  className={`grid min-w-[900px] px-4 py-3 text-body border-b border-bone last:border-b-0 items-center gap-2 ${
                    row.analyzeStatus === 'failed' ? 'bg-negative-bg/30' : noMatch ? 'bg-warning-bg/30' : ''
                  }`}
                  style={{ gridTemplateColumns: '0.4fr 2fr 1fr 1fr 1fr 1.4fr 0.6fr' }}
                >
                  <div>
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => patchRow(row.rowId, { include: e.target.checked })}
                      className="w-4 h-4 accent-graphite"
                    />
                  </div>
                  <div className="pr-2">
                    <SelectInput
                      value={row.employeeId}
                      onChange={(v) => {
                        const emp = employees.find((e) => e.id === v)
                        patchRow(row.rowId, {
                          employeeId: v,
                          employeeName: emp?.name ?? row.extracted.employeeName,
                        })
                      }}
                      options={employeeOptions}
                    />
                    <p className="text-caption text-mid-gray mt-1 truncate">
                      {row.analyzeStatus === 'failed'
                        ? 'No se pudo leer — asigna manual'
                        : `Leído: ${row.extracted.employeeName || '—'}${
                            row.extracted.identification ? ` · CC ${row.extracted.identification}` : ''
                          }`}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">{formatCurrency(row.extracted.totalDevengado, 0)}</div>
                  <div className="text-right tabular-nums text-mid-gray">
                    {formatCurrency(row.extracted.totalDeducciones, 0)}
                  </div>
                  <div className="text-right tabular-nums text-mid-gray">
                    {formatCurrency(row.extracted.netoCancelado, 0)}
                  </div>
                  <div>
                    <CurrencyInput
                      value={String(row.amountToPost || '')}
                      onChange={(v) => patchRow(row.rowId, { amountToPost: Number(v) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite text-right focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all"
                    />
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => setRows((prev) => prev.filter((r) => r.rowId !== row.rowId))}
                      className="p-1 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                    >
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-body text-graphite">
                <span className="font-medium">{includedCount}</span> a registrar ·{' '}
                <span className="font-medium">{formatCurrency(totalToPost, 0)}</span>
              </p>
              <p className="text-caption text-mid-gray mt-1">
                Periodo: {periodLabel} · registrar reemplaza un lote previo del mismo periodo y fecha
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canEdit || submitting || includedCount === 0}
              className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Registrando…' : `Confirmar y registrar ${includedCount}`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-surface rounded-xl card-elevated p-5 space-y-2">
          <div className="flex items-center gap-2 text-body text-positive-text font-medium">
            <Check size={16} strokeWidth={2.5} />
            {result.registered} nóminas registradas para {periodLabel}
          </div>
          {result.failed.length > 0 && (
            <div className="text-caption text-negative-text">
              {result.failed.length} fallaron:
              {result.failed.map((f, i) => (
                <div key={i}>
                  · {f.employeeName}: {f.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PropinasTab({
  companyId,
  employees,
  employeeOptions,
  canEdit,
  periodKey,
  periodLabel,
  paidDate,
}: TabProps) {
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<TipRowState[]>([])
  const [extractedTotal, setExtractedTotal] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleAnalyze() {
    if (!companyId || !file) return
    setAnalyzing(true)
    setError(null)
    setDone(false)
    try {
      const res = await analyzePropinas(companyId, file)
      if (res.extractionFailed) {
        setError('No se pudo leer el archivo de propinas. Intenta con otra imagen o formato.')
        return
      }
      setExtractedTotal(Math.round(res.extracted.total))
      setRows(
        res.extracted.rows.map((r) => {
          const match = matchEmployee(employees, r.employeeName)
          return {
            rowId: uid(),
            extracted: r,
            employeeId: match?.id ?? '',
            employeeName: match?.name ?? r.employeeName,
            amount: Math.round(r.amount),
            include: true,
          }
        }),
      )
    } catch (e) {
      setError((e as Error).message ?? 'Error al procesar con IA')
    } finally {
      setAnalyzing(false)
    }
  }

  function patchRow(rowId: string, patch: Partial<TipRowState>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)))
  }

  const includedSum = rows.filter((r) => r.include && r.amount > 0).reduce((s, r) => s + r.amount, 0)
  const includedCount = rows.filter((r) => r.include && r.amount > 0).length
  const mismatch = extractedTotal > 0 && Math.abs(includedSum - extractedTotal) > 1

  async function handleSubmit() {
    if (!canEdit || includedCount === 0) return
    if (!companyId) {
      setError('Selecciona una empresa antes de registrar.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await registerTipDistribution(companyId, { periodKey, periodLabel, paidDate, rows })
      setDone(true)
      setRows([])
      setFile(null)
    } catch (e) {
      setError((e as Error).message ?? 'Error al registrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-bone/60 border border-border/60 text-caption text-mid-gray">
        <Users size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <span>
          Las propinas son de los empleados. Se registra un gasto que compensa el ingreso de propinas
          de los cierres, así no infla la utilidad — solo queda el detalle por empleado.
        </span>
      </div>

      <Dropzone
        multiple={false}
        accept={PROPINAS_ACCEPT}
        onFiles={(f) => {
          setFile(f[0])
          setDone(false)
          setRows([])
          setError(null)
        }}
        disabled={analyzing || submitting}
      />

      {file && (
        <div className="bg-surface rounded-xl card-elevated p-4 flex items-center gap-3">
          <FileText size={16} strokeWidth={1.5} className="text-mid-gray shrink-0" />
          <span className="text-body text-graphite truncate flex-1">{file.name}</span>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !companyId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <Sparkles size={15} strokeWidth={1.5} />
                Procesar con IA
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text">
          <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-subheading font-medium text-dark-graphite">
              Revisión ({rows.length} empleados)
            </h2>
            {mismatch && (
              <p className="text-caption text-warning-text">
                La suma ({formatCurrency(includedSum, 0)}) no cuadra con el total leído (
                {formatCurrency(extractedTotal, 0)})
              </p>
            )}
          </div>
          <div className="bg-surface rounded-xl card-elevated overflow-x-auto">
            <div
              className="grid min-w-[640px] px-4 py-3 text-caption uppercase tracking-wider font-semibold text-mid-gray border-b border-border bg-card-bg"
              style={{ gridTemplateColumns: '0.4fr 2fr 1.2fr 0.5fr' }}
            >
              <div>Incluir</div>
              <div>Empleado</div>
              <div className="text-right">Valor propina</div>
              <div></div>
            </div>
            {rows.map((row) => (
              <div
                key={row.rowId}
                className={`grid min-w-[640px] px-4 py-3 text-body border-b border-bone last:border-b-0 items-center gap-2 ${
                  !row.employeeId ? 'bg-warning-bg/30' : ''
                }`}
                style={{ gridTemplateColumns: '0.4fr 2fr 1.2fr 0.5fr' }}
              >
                <div>
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(e) => patchRow(row.rowId, { include: e.target.checked })}
                    className="w-4 h-4 accent-graphite"
                  />
                </div>
                <div className="pr-2">
                  <SelectInput
                    value={row.employeeId}
                    onChange={(v) => {
                      const emp = employees.find((e) => e.id === v)
                      patchRow(row.rowId, {
                        employeeId: v,
                        employeeName: emp?.name ?? row.extracted.employeeName,
                      })
                    }}
                    options={employeeOptions}
                  />
                  <p className="text-caption text-mid-gray mt-1 truncate">
                    Leído: {row.extracted.employeeName || '—'}
                  </p>
                </div>
                <div>
                  <CurrencyInput
                    value={String(row.amount || '')}
                    onChange={(v) => patchRow(row.rowId, { amount: Number(v) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite text-right focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all"
                  />
                </div>
                <div className="text-right">
                  <button
                    onClick={() => setRows((prev) => prev.filter((r) => r.rowId !== row.rowId))}
                    className="p-1 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-body text-graphite">
                <span className="font-medium">{includedCount}</span> empleados ·{' '}
                <span className="font-medium">{formatCurrency(includedSum, 0)}</span> en propinas
              </p>
              <p className="text-caption text-mid-gray mt-1">
                Periodo: {periodLabel} · registrar reemplaza la distribución previa del mismo periodo
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canEdit || submitting || includedCount === 0}
              className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Registrando…' : 'Confirmar y registrar'}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="bg-surface rounded-xl card-elevated p-5 flex items-center gap-2 text-body text-positive-text font-medium">
          <Check size={16} strokeWidth={2.5} />
          Propinas registradas para {periodLabel}.
        </div>
      )}
    </div>
  )
}
