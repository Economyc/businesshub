import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
  Landmark,
} from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SelectInput } from '@/core/ui/select-input'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { formatCurrency } from '@/core/utils/format'
import {
  parseBankFile,
  importBankStatement,
  getSavedMapping,
  saveMapping,
} from '../bank-service'
import { useBankStatements } from '../hooks-bank'
import type { BankColumnMapping, ParsedBankFile } from '../types-bank'
import { BankReconcilePanel } from './bank-reconcile-panel'

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPT = '.xlsx,.xls,.csv'

const BANKS = [
  'Bancolombia',
  'Davivienda',
  'Banco de Bogotá',
  'BBVA',
  'Banco de Occidente',
  'Banco Popular',
  'Scotiabank Colpatria',
  'Itaú',
  'Banco Agrario',
  'Nu',
  'Lulo Bank',
  'Nequi',
  'Daviplata',
  'Otro',
]

type MappingField = keyof BankColumnMapping
const MAPPING_LABELS: Record<MappingField, string> = {
  date: 'Fecha',
  description: 'Descripción',
  reference: 'Referencia',
  amount: 'Monto (único firmado)',
  debit: 'Débito / salida',
  credit: 'Crédito / entrada',
  balance: 'Saldo',
}

export function BankImportView() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''
  const { can } = usePermissions()
  const canEdit = can('finance.bank', 'create')

  const [bank, setBank] = useState('Bancolombia')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedBankFile | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    imported: number
    periodStart: string
    periodEnd: string
    statementId: string
    overlapping: { id: string; fileName: string; periodStart: string; periodEnd: string }[]
  } | null>(null)
  const [savedMapping, setSavedMapping] = useState<Partial<BankColumnMapping> | null>(null)

  const { data: statements } = useBankStatements()
  const [reconcileId, setReconcileId] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    getSavedMapping(companyId)
      .then((m) => setSavedMapping(m))
      .catch(() => setSavedMapping(null))
  }, [companyId])

  const runParse = useCallback(
    async (f: File, override?: Partial<BankColumnMapping>) => {
      setParsing(true)
      setError(null)
      setResult(null)
      try {
        const res = await parseBankFile(f, override ?? savedMapping ?? undefined)
        setParsed(res)
      } catch (e) {
        setError((e as Error).message ?? 'No se pudo leer el archivo.')
        setParsed(null)
      } finally {
        setParsing(false)
      }
    },
    [savedMapping],
  )

  const onFile = useCallback(
    (f: File) => {
      if (f.size > MAX_SIZE) {
        setError('El archivo supera 10 MB.')
        return
      }
      setFile(f)
      setResult(null)
      void runParse(f)
    },
    [runParse],
  )

  function patchMapping(field: MappingField, value: string) {
    if (!parsed || !file) return
    const next: BankColumnMapping = { ...parsed.mapping, [field]: value || null }
    setParsed({ ...parsed, mapping: next })
    void runParse(file, next)
  }

  async function handleImport() {
    if (!canEdit || !companyId || !parsed || parsed.rows.length === 0 || !file) return
    setImporting(true)
    setError(null)
    try {
      const res = await importBankStatement(companyId, {
        bank,
        fileName: file.name,
        rows: parsed.rows,
      })
      await saveMapping(companyId, parsed.mapping, bank)
      setResult(res)
      setParsed(null)
      setFile(null)
    } catch (e) {
      setError((e as Error).message ?? 'Error al importar el extracto.')
    } finally {
      setImporting(false)
    }
  }

  const headerOptions = parsed
    ? [{ value: '', label: '(ninguna)' }, ...parsed.headers.filter(Boolean).map((h) => ({ value: h, label: h }))]
    : []

  return (
    <PageTransition>
      <PageHeader title="Extracto Bancario">
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
          <span>No tienes permiso para registrar en Contabilidad. Puedes revisar pero no importar.</span>
        </div>
      )}

      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-bone/60 border border-border/60 text-caption text-mid-gray mb-6">
        <Landmark size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <span>
          Una cuenta por local. El extracto es materia prima: el P&L y el Flujo de Caja no
          cambian hasta conciliar (eso deriva la comisión de Rappi y las retenciones).
        </span>
      </div>

      {/* Banco + carga */}
      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 mb-6">
        <div>
          <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">
            Banco
          </label>
          <SelectInput
            value={bank}
            onChange={setBank}
            options={BANKS.map((b) => ({ value: b, label: b }))}
          />
        </div>
        <Dropzone onFile={onFile} disabled={parsing || importing} fileName={file?.name} />
      </div>

      {parsing && (
        <div className="flex items-center gap-2 text-body text-mid-gray mb-6">
          <Loader2 size={15} className="animate-spin" />
          Leyendo el archivo…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text mb-6">
          <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {parsed && (
        <div className="space-y-6">
          {/* Mapeo de columnas */}
          <div className="bg-surface rounded-xl card-elevated p-4">
            <h2 className="text-subheading font-medium text-dark-graphite mb-1">Mapeo de columnas</h2>
            <p className="text-caption text-mid-gray mb-4">
              Detectado automáticamente. Corrige si alguna columna quedó mal y se vuelve a leer.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(MAPPING_LABELS) as MappingField[]).map((f) => (
                <div key={f}>
                  <label className="block text-caption text-mid-gray mb-1">{MAPPING_LABELS[f]}</label>
                  <SelectInput
                    value={parsed.mapping[f] ?? ''}
                    onChange={(v) => patchMapping(f, v)}
                    options={headerOptions}
                  />
                </div>
              ))}
            </div>
          </div>

          {parsed.warnings.length > 0 && (
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-warning-bg/50 border border-warning/20 text-caption text-warning-text">
              {parsed.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {parsed.rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-subheading font-medium text-dark-graphite">
                  Vista previa ({parsed.rows.length} movimientos)
                </h2>
                <p className="text-caption text-mid-gray">Mostrando las primeras 20 filas</p>
              </div>
              <div className="bg-surface rounded-xl card-elevated overflow-x-auto">
                <div
                  className="grid min-w-[760px] px-4 py-3 text-caption uppercase tracking-wider font-semibold text-mid-gray border-b border-border bg-card-bg"
                  style={{ gridTemplateColumns: '1fr 3fr 1.4fr 1.4fr' }}
                >
                  <div>Fecha</div>
                  <div>Descripción</div>
                  <div className="text-right">Monto</div>
                  <div className="text-right">Saldo</div>
                </div>
                {parsed.rows.slice(0, 20).map((r, i) => (
                  <div
                    key={i}
                    className="grid min-w-[760px] px-4 py-2.5 text-body border-b border-bone last:border-b-0 items-center"
                    style={{ gridTemplateColumns: '1fr 3fr 1.4fr 1.4fr' }}
                  >
                    <div className="tabular-nums text-graphite">{r.date}</div>
                    <div className="text-graphite truncate pr-2">{r.description || '—'}</div>
                    <div
                      className={`text-right tabular-nums ${
                        r.direction === 'in' ? 'text-positive-text' : 'text-graphite'
                      }`}
                    >
                      {formatCurrency(r.amount, 0)}
                    </div>
                    <div className="text-right tabular-nums text-mid-gray">
                      {r.balance !== undefined ? formatCurrency(r.balance, 0) : '—'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-caption text-mid-gray">
                  {parsed.rows.length} movimientos · {bank} · reimportar el mismo archivo y periodo
                  reemplaza, no duplica
                </p>
                <button
                  onClick={handleImport}
                  disabled={!canEdit || importing || parsed.rows.length === 0}
                  className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importando…' : `Importar ${parsed.rows.length} movimientos`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="bg-surface rounded-xl card-elevated p-5 space-y-2 mb-6">
          <div className="flex items-center gap-2 text-body text-positive-text font-medium">
            <Check size={16} strokeWidth={2.5} />
            {result.imported} movimientos importados ({result.periodStart} → {result.periodEnd})
          </div>
          {result.overlapping.length > 0 && (
            <div className="text-caption text-warning-text">
              El periodo se solapa con {result.overlapping.length} extracto(s) ya importado(s):
              {result.overlapping.map((o) => (
                <div key={o.id}>
                  · {o.fileName} ({o.periodStart} → {o.periodEnd})
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <button
              onClick={() => setReconcileId(result.statementId)}
              className="mt-1 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all"
            >
              Conciliar este extracto
            </button>
          )}
        </div>
      )}

      {/* Extractos importados */}
      {statements.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-subheading font-medium text-dark-graphite">Extractos importados</h2>
          <div className="bg-surface rounded-xl card-elevated overflow-x-auto">
            <div
              className="grid min-w-[720px] px-4 py-3 text-caption uppercase tracking-wider font-semibold text-mid-gray border-b border-border bg-card-bg"
              style={{ gridTemplateColumns: '2.4fr 1.4fr 1fr 1fr 1fr' }}
            >
              <div>Archivo</div>
              <div>Banco</div>
              <div>Periodo</div>
              <div className="text-right">Movs.</div>
              <div className="text-right">Acción</div>
            </div>
            {statements.map((s) => (
              <div
                key={s.id}
                className="grid min-w-[720px] px-4 py-3 text-body border-b border-bone last:border-b-0 items-center"
                style={{ gridTemplateColumns: '2.4fr 1.4fr 1fr 1fr 1fr' }}
              >
                <div className="text-graphite truncate pr-2">{s.fileName}</div>
                <div className="text-mid-gray">{s.bank}</div>
                <div className="text-caption text-mid-gray tabular-nums">
                  {s.periodStart.toDate().toISOString().slice(0, 10)} →{' '}
                  {s.periodEnd.toDate().toISOString().slice(0, 10)}
                </div>
                <div className="text-right tabular-nums">{s.rowCount}</div>
                <div className="text-right">
                  <button
                    onClick={() => setReconcileId(s.id)}
                    disabled={!canEdit}
                    className="text-caption font-medium text-graphite hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {s.status === 'reconciled' ? 'Ver conciliación' : 'Conciliar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reconcileId && (
        <div className="mt-8">
          <BankReconcilePanel
            companyId={companyId}
            statementId={reconcileId}
            canEdit={canEdit}
            onClose={() => setReconcileId(null)}
          />
        </div>
      )}
    </PageTransition>
  )
}

function Dropzone({
  onFile,
  disabled,
  fileName,
}: {
  onFile: (f: File) => void
  disabled?: boolean
  fileName?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

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
        if (!disabled && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0])
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
      {fileName ? (
        <>
          <FileText size={24} strokeWidth={1.5} className="text-mid-gray" />
          <p className="text-body font-medium text-graphite text-center">{fileName}</p>
          <p className="text-caption text-mid-gray">Haz clic para cambiar el archivo</p>
        </>
      ) : (
        <>
          <Upload size={28} strokeWidth={1.5} className="text-mid-gray" />
          <p className="text-body font-medium text-graphite text-center">
            Arrastra el extracto o haz clic para subir
          </p>
          <p className="text-caption text-mid-gray">Excel o CSV — máx. 10 MB</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={(e) => {
          if (e.target.files?.[0]) onFile(e.target.files[0])
          if (inputRef.current) inputRef.current.value = ''
        }}
        className="hidden"
      />
    </div>
  )
}
