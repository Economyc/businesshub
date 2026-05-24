import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
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
  ChevronRight,
  ExternalLink,
  Wallet,
} from 'lucide-react'
import type { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { CurrencyInput } from '@/core/ui/currency-input'
import { SelectInput } from '@/core/ui/select-input'
import { DateInput } from '@/core/ui/date-input'
import { StaleDateWarning } from './stale-date-warning'
import { isDateTooOld } from '../utils/date-validation'
import { useCompany } from '@/core/hooks/use-company'
import { useCollection } from '@/core/hooks/use-firestore'
import { usePermissions } from '@/core/hooks/use-permissions'
import { TAB_IDS } from '@/core/config/access-registry'
import { formatCurrency } from '@/core/utils/format'
import { EmptyState } from '@/core/ui/empty-state'
import type { Employee } from '@/modules/talent/types'
import {
  analyzeColilla,
  analyzePropinas,
  matchEmployee,
  mapWithConcurrency,
  registerPayrollBatch,
  registerTipDistribution,
} from '../payroll-service'
import type {
  PayrollRowState,
  TipRowState,
  PayrollBatchDoc,
  TipDistributionDoc,
} from '../types-payroll'

const MAX_SIZE = 10 * 1024 * 1024
const COLILLA_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'
const PROPINAS_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.csv,.xlsx,.xls'
const ANALYZE_CONCURRENCY = 3

type Tab = 'nomina' | 'propinas' | 'historial'

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
  // Anclamos a mediodía para que el mes del paidDate (nómina/propinas) sea inmune
  // a la zona horaria: el server clasifica el mes de la hoja en hora Bogotá.
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
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

function monthKeyOf(ts: Timestamp): string {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtDay(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function PayrollView() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''
  const { data: employees } = useCollection<Employee>('employees')
  const { can, canAccessTab } = usePermissions()
  const canEdit = can('finance.payroll', 'create')

  const payrollTabs = [
    { value: 'nomina', label: 'Nómina', tabId: TAB_IDS.payrollNomina },
    { value: 'propinas', label: 'Propinas', tabId: TAB_IDS.payrollPropinas },
    { value: 'historial', label: 'Historial', tabId: TAB_IDS.payrollHistorial },
  ].filter((t) => canAccessTab(t.tabId))

  const [tab, setTab] = useState<Tab>('nomina')
  // Si el tab activo no es visible para el rol, caer al primero disponible.
  useEffect(() => {
    if (payrollTabs.length > 0 && !payrollTabs.some((t) => t.value === tab)) {
      setTab(payrollTabs[0].value as Tab)
    }
  }, [payrollTabs, tab])
  const [periodLabel, setPeriodLabel] = useState('')
  const [paidDate, setPaidDate] = useState(todayISO())
  const [dateConfirmed, setDateConfirmed] = useState(false)

  // Si cambia la fecha de pago, re-exigir confirmación del aviso.
  useEffect(() => {
    setDateConfirmed(false)
  }, [paidDate])
  const dateBlocked = isDateTooOld(paidDate) && !dateConfirmed

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

      {/* Periodo (solo al registrar) */}
      {tab !== 'historial' && (
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
          {isDateTooOld(paidDate) && (
            <div className="mt-2">
              <StaleDateWarning
                dateISO={paidDate}
                fieldLabel="fecha del pago"
                confirmed={dateConfirmed}
                onConfirmChange={setDateConfirmed}
              />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-lg bg-bone/60 border border-border/60 mb-6 max-w-xl">
        {payrollTabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value as Tab)}
            className={`flex-1 px-4 py-2 rounded-lg text-body font-medium transition-colors ${
              tab === t.value ? 'bg-surface text-graphite card-elevated' : 'text-mid-gray hover:text-graphite'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'nomina' ? (
        <NominaTab
          companyId={companyId}
          employees={employees}
          employeeOptions={employeeOptions}
          canEdit={canEdit}
          dateBlocked={dateBlocked}
          periodKey={periodKey}
          periodLabel={effectiveLabel}
          paidDate={parseISO(paidDate)}
        />
      ) : tab === 'propinas' ? (
        <PropinasTab
          companyId={companyId}
          employees={employees}
          employeeOptions={employeeOptions}
          canEdit={canEdit}
          dateBlocked={dateBlocked}
          periodKey={periodKey}
          periodLabel={effectiveLabel}
          paidDate={parseISO(paidDate)}
        />
      ) : (
        <HistorialTab />
      )}
    </PageTransition>
  )
}

interface TabProps {
  companyId: string
  employees: Employee[]
  employeeOptions: { value: string; label: string }[]
  canEdit: boolean
  dateBlocked: boolean
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
  dateBlocked,
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
    if (!canEdit || dateBlocked || includedCount === 0) return
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
              disabled={!canEdit || dateBlocked || submitting || includedCount === 0}
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
  dateBlocked,
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
    if (!canEdit || dateBlocked || includedCount === 0) return
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
              disabled={!canEdit || dateBlocked || submitting || includedCount === 0}
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

interface EmpAgg {
  employeeId: string
  employeeName: string
  count: number
  salary: number
  tips: number
  details: {
    kind: 'salario' | 'propina'
    periodLabel: string
    paidDate: Timestamp
    amount: number
    link?: string
  }[]
}

const HIST_GRID = '1.7fr 0.5fr 1fr 1fr 1fr 0.3fr'

function HistorialTab() {
  const { data: batches, loading: lb } = useCollection<PayrollBatchDoc>('payroll-batches')
  const { data: tips, loading: lt } = useCollection<TipDistributionDoc>('tip-distributions')
  const loading = lb || lt

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const b of batches) if (b.paidDate) set.add(monthKeyOf(b.paidDate))
    for (const t of tips) if (t.paidDate) set.add(monthKeyOf(t.paidDate))
    set.add(currentMonthKey())
    return Array.from(set).sort().reverse()
  }, [batches, tips])

  const [month, setMonth] = useState(currentMonthKey)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const rows = useMemo(() => {
    const map = new Map<string, EmpAgg>()
    const ensure = (id: string, name: string): EmpAgg => {
      let e = map.get(id)
      if (!e) {
        e = { employeeId: id, employeeName: name, count: 0, salary: 0, tips: 0, details: [] }
        map.set(id, e)
      }
      return e
    }
    for (const b of batches) {
      if (!b.paidDate || monthKeyOf(b.paidDate) !== month) continue
      for (const ln of b.lines ?? []) {
        const e = ensure(ln.employeeId || ln.employeeName, ln.employeeName)
        e.salary += ln.amountPosted || 0
        e.count += 1
        e.details.push({
          kind: 'salario',
          periodLabel: b.periodLabel,
          paidDate: b.paidDate,
          amount: ln.amountPosted || 0,
          link: ln.driveWebViewLink,
        })
      }
    }
    for (const t of tips) {
      if (!t.paidDate || monthKeyOf(t.paidDate) !== month) continue
      for (const ln of t.lines ?? []) {
        const e = ensure(ln.employeeId || ln.employeeName, ln.employeeName)
        e.tips += ln.amount || 0
        e.details.push({
          kind: 'propina',
          periodLabel: t.periodLabel,
          paidDate: t.paidDate,
          amount: ln.amount || 0,
        })
      }
    }
    const arr = Array.from(map.values())
    arr.forEach((e) =>
      e.details.sort((a, b) => a.paidDate.toDate().getTime() - b.paidDate.toDate().getTime()),
    )
    return arr.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'es'))
  }, [batches, tips, month])

  const totals = useMemo(
    () => ({
      count: rows.reduce((s, e) => s + e.count, 0),
      salary: rows.reduce((s, e) => s + e.salary, 0),
      tips: rows.reduce((s, e) => s + e.tips, 0),
    }),
    [rows],
  )

  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">
          Mes
        </label>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {fmtMonthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin pagos este mes"
          description="No hay nómina ni propinas registradas para el mes seleccionado."
        />
      ) : (
        <div className="bg-surface rounded-xl card-elevated overflow-x-auto">
          <div
            className="grid min-w-[760px] px-4 py-3 text-caption uppercase tracking-wider font-semibold text-mid-gray border-b border-border bg-card-bg"
            style={{ gridTemplateColumns: HIST_GRID }}
          >
            <div>Empleado</div>
            <div className="text-right">Pagos</div>
            <div className="text-right">Salario</div>
            <div className="text-right">Propinas</div>
            <div className="text-right">Total</div>
            <div></div>
          </div>

          {rows.map((e) => {
            const isOpen = expanded.has(e.employeeId)
            const total = e.salary + e.tips
            return (
              <div key={e.employeeId}>
                <div
                  onClick={() => toggle(e.employeeId)}
                  className="grid min-w-[760px] px-4 py-3 text-body border-b border-bone last:border-b-0 items-center cursor-pointer hover:bg-bone/50 transition-colors"
                  style={{ gridTemplateColumns: HIST_GRID }}
                >
                  <div className="font-medium text-dark-graphite truncate pr-2">{e.employeeName}</div>
                  <div className="text-right tabular-nums text-mid-gray">{e.count}</div>
                  <div className="text-right tabular-nums">
                    {e.salary > 0 ? formatCurrency(e.salary, 0) : '—'}
                  </div>
                  <div className="text-right tabular-nums">
                    {e.tips > 0 ? formatCurrency(e.tips, 0) : '—'}
                  </div>
                  <div className="text-right tabular-nums font-medium text-dark-graphite">
                    {formatCurrency(total, 0)}
                  </div>
                  <div className="flex justify-end">
                    <ChevronRight
                      size={14}
                      strokeWidth={1.5}
                      className={`text-mid-gray transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </div>
                </div>

                {isOpen && (
                  <div className="bg-bone/40 border-b border-bone px-4 py-3 space-y-2">
                    {e.details.map((d, i) => (
                      <div
                        key={i}
                        className="grid min-w-[720px] text-caption items-center gap-2"
                        style={{ gridTemplateColumns: '1.5fr 1fr 0.8fr 1fr 1fr' }}
                      >
                        <div className="text-graphite truncate">{d.periodLabel}</div>
                        <div className="text-mid-gray">{fmtDay(d.paidDate)}</div>
                        <div className="text-mid-gray">
                          {d.kind === 'salario' ? 'Salario' : 'Propina'}
                        </div>
                        <div className="text-right tabular-nums text-graphite">
                          {formatCurrency(d.amount, 0)}
                        </div>
                        <div className="text-right">
                          {d.kind === 'salario' && d.link ? (
                            <a
                              href={d.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(ev) => ev.stopPropagation()}
                              className="inline-flex items-center gap-1 text-mid-gray hover:text-graphite transition-colors"
                            >
                              <ExternalLink size={12} strokeWidth={1.5} />
                              Colilla
                            </a>
                          ) : (
                            <span className="text-mid-gray">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div
            className="grid min-w-[760px] px-4 py-3 text-body bg-card-bg items-center font-medium text-dark-graphite"
            style={{ gridTemplateColumns: HIST_GRID }}
          >
            <div>Total</div>
            <div className="text-right tabular-nums">{totals.count}</div>
            <div className="text-right tabular-nums">{formatCurrency(totals.salary, 0)}</div>
            <div className="text-right tabular-nums">
              {totals.tips > 0 ? formatCurrency(totals.tips, 0) : '—'}
            </div>
            <div className="text-right tabular-nums">
              {formatCurrency(totals.salary + totals.tips, 0)}
            </div>
            <div></div>
          </div>
        </div>
      )}
    </div>
  )
}
