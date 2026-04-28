import { TrendingUp, ChevronUp, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/core/utils/format'
import type { DashboardProjection } from '../hooks'

interface MonthProjectionTileProps {
  projection: DashboardProjection
}

export function MonthProjectionTile({ projection }: MonthProjectionTileProps) {
  if (!projection.applicable) return null

  const {
    projected,
    mtd,
    daysElapsed,
    daysInMonth,
    daysRemaining,
    deltaVsLastMonth,
    deltaTrend,
    lastMonthTotal,
  } = projection

  const progressPct = Math.min(100, Math.round((daysElapsed / daysInMonth) * 100))

  const deltaClass =
    deltaTrend === 'up'
      ? 'bg-positive-bg text-positive-text'
      : deltaTrend === 'down'
        ? 'bg-negative-bg text-negative-text'
        : 'bg-warning-bg text-warning-text'

  return (
    <div className="bg-surface-elevated rounded-xl p-4 sm:p-[18px] border border-dashed border-border-hover/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Valor proyectado */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} strokeWidth={1.5} className="text-mid-gray" />
            <span className="text-caption text-mid-gray">
              Proyección fin de mes
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg sm:text-kpi font-semibold text-dark-graphite">
              {formatCurrency(projected)}
            </span>
            {deltaVsLastMonth !== 'n/d' && (
              <span
                className={`inline-flex items-center gap-[3px] text-caption px-2 py-0.5 rounded-full ${deltaClass}`}
              >
                {deltaTrend === 'up' ? (
                  <ChevronUp size={12} strokeWidth={1.5} />
                ) : deltaTrend === 'down' ? (
                  <ChevronDown size={12} strokeWidth={1.5} />
                ) : null}
                {deltaVsLastMonth}
              </span>
            )}
            {lastMonthTotal > 0 && (
              <span className="text-caption text-mid-gray">
                vs mes anterior
              </span>
            )}
          </div>
        </div>

        {/* Real acumulado + progreso dual */}
        <div className="sm:text-right sm:min-w-[240px]">
          <div className="text-caption text-mid-gray mb-1">
            Real acumulado
          </div>
          <div className="text-subheading font-medium text-dark-graphite mb-2">
            {formatCurrency(mtd)}
          </div>

          <div className="relative h-2 rounded-full bg-smoke overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-graphite rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="absolute inset-y-0 rounded-full transition-all"
              style={{
                left: `${progressPct}%`,
                width: `${100 - progressPct}%`,
                backgroundImage:
                  'repeating-linear-gradient(90deg, var(--app-border-hover) 0 3px, transparent 3px 6px)',
              }}
            />
          </div>

          <div className="mt-1.5 text-caption text-mid-gray">
            Día {daysElapsed} de {daysInMonth}
            {daysRemaining > 0 && ` · faltan ${daysRemaining}`}
          </div>
        </div>
      </div>

      <div className="mt-3 text-caption text-mid-gray">
        Proyección basada en el promedio diario del mes en curso.
      </div>
    </div>
  )
}
