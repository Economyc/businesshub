import { Receipt } from 'lucide-react'
import { formatCurrency } from '@/core/utils/format'
import type { CajaOverviewRow } from '../hooks'

interface CajasOverviewCardProps {
  rows: CajaOverviewRow[]
  periodLabel: string
}

export function CajasOverviewCard({ rows, periodLabel }: CajasOverviewCardProps) {
  if (rows.length === 0) return null

  const totals = rows.reduce(
    (acc, r) => ({
      cantidad: acc.cantidad + r.cantidad,
      ventasNetas: acc.ventasNetas + r.ventasNetas,
      propinas: acc.propinas + r.propinas,
      envio: acc.envio + r.envio,
      total: acc.total + r.total,
      anuladas: acc.anuladas + r.anuladas,
    }),
    { cantidad: 0, ventasNetas: 0, propinas: 0, envio: 0, total: 0, anuladas: 0 },
  )

  return (
    <div className="card-elevated rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt size={16} strokeWidth={1.5} className="text-mid-gray" />
          <span className="text-caption font-semibold text-dark-graphite uppercase tracking-wider">
            Desglose por caja
          </span>
        </div>
        <span className="text-caption text-mid-gray">{periodLabel}</span>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-caption text-mid-gray uppercase tracking-wider border-b border-border/60">
              <th className="pb-2 pr-4 font-semibold">Caja</th>
              <th className="pb-2 pr-4 font-semibold text-right">Tickets</th>
              <th className="pb-2 pr-4 font-semibold text-right">Netas</th>
              <th className="pb-2 pr-4 font-semibold text-right">Propinas</th>
              <th className="pb-2 pr-4 font-semibold text-right">Envío</th>
              <th className="pb-2 pr-4 font-semibold text-right">Total</th>
              <th className="pb-2 font-semibold text-right">Anul.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cajaId} className="border-b border-border/30 last:border-0">
                <td className="py-2 pr-4 text-graphite">Caja {r.cajaId}</td>
                <td className="py-2 pr-4 text-right text-graphite tabular-nums">{r.cantidad}</td>
                <td className="py-2 pr-4 text-right text-graphite tabular-nums">
                  {formatCurrency(r.ventasNetas)}
                </td>
                <td className="py-2 pr-4 text-right text-graphite tabular-nums">
                  {r.propinas > 0 ? formatCurrency(r.propinas) : '—'}
                </td>
                <td className="py-2 pr-4 text-right text-graphite tabular-nums">
                  {r.envio > 0 ? formatCurrency(r.envio) : '—'}
                </td>
                <td className="py-2 pr-4 text-right text-dark-graphite font-semibold tabular-nums">
                  {formatCurrency(r.total)}
                </td>
                <td className="py-2 text-right text-mid-gray tabular-nums">
                  {r.anuladas > 0 ? r.anuladas : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/60">
              <td className="pt-3 pr-4 text-dark-graphite font-semibold">Total</td>
              <td className="pt-3 pr-4 text-right text-dark-graphite font-semibold tabular-nums">
                {totals.cantidad}
              </td>
              <td className="pt-3 pr-4 text-right text-dark-graphite font-semibold tabular-nums">
                {formatCurrency(totals.ventasNetas)}
              </td>
              <td className="pt-3 pr-4 text-right text-dark-graphite font-semibold tabular-nums">
                {formatCurrency(totals.propinas)}
              </td>
              <td className="pt-3 pr-4 text-right text-dark-graphite font-semibold tabular-nums">
                {formatCurrency(totals.envio)}
              </td>
              <td className="pt-3 pr-4 text-right text-dark-graphite font-semibold tabular-nums">
                {formatCurrency(totals.total)}
              </td>
              <td className="pt-3 text-right text-mid-gray tabular-nums">
                {totals.anuladas > 0 ? totals.anuladas : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
