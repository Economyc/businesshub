import { useState } from 'react'
import { X, Loader2, Check, AlertTriangle, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/core/utils/format'
import { runBankReconcile, type ReconcileResult } from '../bank-service'
import { useBankMovements } from '../hooks-bank'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  matched: 'Cuadrado',
  derived: 'Derivado',
  partial: 'Revisar',
  ignored: 'Ignorado',
}

const STATUS_CLASS: Record<string, string> = {
  derived: 'text-positive-text',
  matched: 'text-graphite',
  partial: 'text-warning-text',
  ignored: 'text-mid-gray',
  pending: 'text-mid-gray',
}

export function BankReconcilePanel({
  companyId,
  statementId,
  canEdit,
  onClose,
}: {
  companyId: string
  statementId: string
  canEdit: boolean
  onClose: () => void
}) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ReconcileResult | null>(null)
  const { data: movements, refetch } = useBankMovements(statementId)

  async function handleRun() {
    if (!canEdit) return
    setRunning(true)
    setError(null)
    try {
      const res = await runBankReconcile(companyId, statementId)
      setResult(res)
      await refetch()
    } catch (e) {
      setError((e as Error).message ?? 'Error al conciliar.')
    } finally {
      setRunning(false)
    }
  }

  const inflows = movements.filter((m) => m.direction === 'in')

  return (
    <div className="bg-surface rounded-xl card-elevated p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-subheading font-medium text-dark-graphite">Conciliación bancaria</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-bone/60 border border-border/60 text-caption text-mid-gray">
        <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <span>
          Clasifica solo las entradas (datáfono y Rappi), las cuadra contra los cierres y la venta
          Rappi del POS, y deriva la comisión de Rappi y la retención del datáfono como gastos.
          No crea ingresos (el bruto ya entró por los cierres). Recorrer dos veces no duplica.
        </span>
      </div>

      <button
        onClick={handleRun}
        disabled={!canEdit || running}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {running ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Conciliando…
          </>
        ) : (
          <>
            <Sparkles size={15} strokeWidth={1.5} />
            {result ? 'Volver a conciliar' : 'Conciliar ahora'}
          </>
        )}
      </button>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text">
          <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ResultCard
            title="Comisión Rappi"
            amount={result.rappiCommission}
            status={result.rappiStatus}
            detail={`Bruto POS ${formatCurrency(result.posRappiGross, 0)} − banco ${formatCurrency(
              result.bankRappiNet,
              0,
            )}`}
          />
          <ResultCard
            title="Retención datáfono"
            amount={result.tcRetencion}
            status={result.tcStatus}
            detail={`Datáfono cierres ${formatCurrency(
              result.sumDatafonoClosings,
              0,
            )} − banco ${formatCurrency(result.bankTcNet, 0)}`}
          />
        </div>
      )}

      {result && (
        <div className="text-caption text-mid-gray space-y-1">
          <p>
            Periodo {result.periodStart} → {result.periodEnd} · {result.inflows} entradas ·{' '}
            {result.closingsCount} cierres · {result.posVentasSeen} ventas POS revisadas
          </p>
          {result.partialCount > 0 && (
            <p className="text-warning-text">
              {result.partialCount} movimientos quedaron en revisión (no se inventó plata).
            </p>
          )}
          {result.derivedTransactions.length === 0 && (
            <p className="text-warning-text">
              No se derivó ningún gasto: revisa que haya cierres del periodo y venta Rappi en el POS.
            </p>
          )}
        </div>
      )}

      {inflows.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-body font-medium text-dark-graphite">
            Entradas del extracto ({inflows.length})
          </h3>
          <div className="bg-card-bg rounded-lg border border-border/60 overflow-x-auto">
            <div
              className="grid min-w-[680px] px-4 py-2.5 text-caption uppercase tracking-wider font-semibold text-mid-gray border-b border-border"
              style={{ gridTemplateColumns: '1fr 2.6fr 1.2fr 1fr 1fr' }}
            >
              <div>Fecha</div>
              <div>Descripción</div>
              <div className="text-right">Monto</div>
              <div>Clase</div>
              <div>Estado</div>
            </div>
            {inflows.map((m) => (
              <div
                key={m.id}
                className="grid min-w-[680px] px-4 py-2.5 text-body border-b border-bone last:border-b-0 items-center"
                style={{ gridTemplateColumns: '1fr 2.6fr 1.2fr 1fr 1fr' }}
              >
                <div className="tabular-nums text-mid-gray text-caption">
                  {m.date.toDate().toISOString().slice(0, 10)}
                </div>
                <div className="text-graphite truncate pr-2">{m.description || '—'}</div>
                <div className="text-right tabular-nums text-positive-text">
                  {formatCurrency(m.amount, 0)}
                </div>
                <div className="text-caption text-mid-gray">{m.classification ?? '—'}</div>
                <div
                  className={`text-caption font-medium ${
                    STATUS_CLASS[m.reconcileStatus] ?? 'text-mid-gray'
                  }`}
                >
                  {STATUS_LABEL[m.reconcileStatus] ?? m.reconcileStatus}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({
  title,
  amount,
  status,
  detail,
}: {
  title: string
  amount: number
  status: 'derived' | 'partial' | 'skipped'
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border/60 p-4 bg-card-bg">
      <div className="flex items-center justify-between">
        <span className="text-caption uppercase tracking-wider font-semibold text-mid-gray">
          {title}
        </span>
        {status === 'derived' ? (
          <span className="flex items-center gap-1 text-caption text-positive-text font-medium">
            <Check size={12} strokeWidth={2.5} /> Derivado
          </span>
        ) : status === 'partial' ? (
          <span className="text-caption text-warning-text font-medium">Revisar</span>
        ) : (
          <span className="text-caption text-mid-gray">Sin datos</span>
        )}
      </div>
      <p className="text-kpi text-dark-graphite tabular-nums mt-1">
        {status === 'derived' ? formatCurrency(amount, 0) : '—'}
      </p>
      <p className="text-caption text-mid-gray mt-1">{detail}</p>
    </div>
  )
}
