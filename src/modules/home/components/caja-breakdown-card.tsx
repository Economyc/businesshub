import { Receipt } from 'lucide-react'
import { formatCurrency } from '@/core/utils/format'
import type { CajaBreakdown } from '../hooks'

interface CajaBreakdownCardProps {
  cajaId: string
  breakdown: CajaBreakdown
  periodLabel: string
}

export function CajaBreakdownCard({ cajaId, breakdown, periodLabel }: CajaBreakdownCardProps) {
  const {
    ventasNetas,
    propinas,
    envio,
    impuestos,
    total,
    totalConImpuestos,
    totalConImpuestosYAnuladas,
    cantidad,
    anuladas,
    montoAnulado,
    porTipo,
  } = breakdown

  return (
    <div className="card-elevated rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt size={16} strokeWidth={1.5} className="text-mid-gray" />
          <span className="text-caption font-semibold text-dark-graphite uppercase tracking-wider">
            Desglose · Caja {cajaId}
          </span>
        </div>
        <span className="text-caption text-mid-gray">{periodLabel}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Row label="Ventas netas" value={ventasNetas} />
          {propinas > 0 && <Row label="Propinas" value={propinas} />}
          {envio > 0 && <Row label="Envío" value={envio} />}
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <span className="text-body font-medium text-dark-graphite">Total</span>
            <span className="text-subheading font-semibold text-dark-graphite">
              {formatCurrency(total)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-caption text-mid-gray">Comprobantes</span>
            <span className="text-caption text-graphite">
              {cantidad}
              {anuladas > 0 && (
                <span className="text-mid-gray">
                  {' · '}
                  {anuladas} anuladas ({formatCurrency(montoAnulado)})
                </span>
              )}
            </span>
          </div>

          {(impuestos > 0 || anuladas > 0) && (
            <div className="pt-3 mt-2 border-t border-border/60 space-y-1">
              <div className="text-caption font-semibold text-dark-graphite uppercase tracking-wider mb-1">
                Para cuadrar con POS
              </div>
              {impuestos > 0 && (
                <Row label="+ Impuestos" value={impuestos} muted />
              )}
              {impuestos > 0 && (
                <Row label="Total con impuestos" value={totalConImpuestos} muted />
              )}
              {anuladas > 0 && (
                <Row
                  label={impuestos > 0 ? 'Total con impuestos + anuladas' : 'Total + anuladas'}
                  value={totalConImpuestosYAnuladas}
                  muted
                />
              )}
            </div>
          )}
        </div>

        {porTipo.length > 0 && (
          <div className="space-y-2">
            <div className="text-caption font-semibold text-dark-graphite uppercase tracking-wider mb-1">
              Por tipo
            </div>
            {porTipo.map((row) => (
              <div key={row.tipo} className="flex items-center justify-between">
                <span className="text-body text-graphite">
                  {row.label}{' '}
                  <span className="text-caption text-mid-gray">· {row.count}</span>
                </span>
                <span className="text-body text-graphite">{formatCurrency(row.monto)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-body ${muted ? 'text-mid-gray' : 'text-mid-gray'}`}>{label}</span>
      <span className={`text-body tabular-nums ${muted ? 'text-mid-gray' : 'text-graphite'}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}
