import { ArrowDown } from 'lucide-react'
import type { Bridge } from '@/core/pnl/bridge.ts'
import { formatCurrency } from '@/core/utils/format'

interface BridgeCardProps {
  bridge: Bridge
  monthLabel: string
}

/**
 * De la utilidad a la caja. Es la respuesta a la pregunta que hace el socio al
 * ver la utilidad: "¿y esa plata dónde está?".
 *
 * Va pegado al P&L a propósito, no escondido en una nota al pie: la utilidad
 * sola se lee como dinero disponible, y casi nunca lo es.
 */
export function BridgeCard({ bridge, monthLabel }: BridgeCardProps) {
  const negativa = bridge.caja < 0

  return (
    <div className="bg-surface rounded-xl card-elevated overflow-hidden">
      <div className="px-6 py-4 border-b border-border/60">
        <h3 className="text-subheading font-medium text-dark-graphite">
          De la utilidad a la caja
        </h3>
        <p className="text-caption text-mid-gray">
          {monthLabel} · qué pasó entre lo que se ganó y lo que quedó
        </p>
      </div>

      <div className="px-6 py-4 space-y-2">
        {bridge.filas.map((f, i) => {
          const isBase = f.tipo === 'base'
          const isTotal = f.tipo === 'total'
          if (isTotal) return null
          return (
            <div
              key={`${f.label}-${i}`}
              className={`flex items-baseline justify-between gap-4 ${isBase ? 'pb-2 border-b border-border/60' : ''}`}
            >
              <span className={`text-body ${isBase ? 'text-dark-graphite font-medium' : 'text-graphite'}`}>
                {f.label}
              </span>
              <span
                className={`text-body tabular-nums shrink-0 ${
                  isBase
                    ? 'text-dark-graphite font-medium'
                    : f.valor < 0
                      ? 'text-negative-text'
                      : 'text-positive-text'
                }`}
              >
                {f.valor > 0 && !isBase ? '+' : ''}{formatCurrency(f.valor)}
              </span>
            </div>
          )
        })}
      </div>

      <div className={`px-6 py-4 border-t border-border ${negativa ? 'bg-negative-bg' : 'bg-positive-bg'}`}>
        <div className="flex items-baseline justify-between gap-4">
          <span className={`text-body font-medium ${negativa ? 'text-negative-text' : 'text-positive-text'}`}>
            <ArrowDown size={16} strokeWidth={1.5} className="inline mb-0.5 mr-1" />
            Caja que dejó el mes
          </span>
          <span className={`text-kpi font-semibold tabular-nums ${negativa ? 'text-negative-text' : 'text-positive-text'}`}>
            {formatCurrency(bridge.caja)}
          </span>
        </div>
        {negativa && (
          <p className="text-caption text-negative-text mt-2">
            El mes dio utilidad pero consumió caja. Esa diferencia no es plata disponible
            para repartir.
          </p>
        )}
      </div>

      {bridge.porPagar > 0 && (
        <div className="px-6 py-4 border-t border-border/60 bg-bone">
          <p className="text-caption text-mid-gray">
            Quedan <span className="text-graphite font-medium">{formatCurrency(bridge.porPagar)}</span> causados
            sin pagar. Mientras el negocio pague con retraso, la caja va a ir siempre un mes
            detrás de la utilidad; ponerse al día cuesta ese valor una sola vez.
          </p>
        </div>
      )}
    </div>
  )
}
