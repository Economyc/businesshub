import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'

interface AnalyticsHeroProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export function AnalyticsHero({
  eyebrow = 'Análisis',
  title,
  description,
  actions,
}: AnalyticsHeroProps) {
  const { startDate, endDate, presetLabel } = useDateRange()
  const rangeCaption = `${formatShort(startDate)} — ${formatShort(endDate)}`

  return (
    <div className="mb-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-caption uppercase tracking-wider text-mid-gray font-medium">
              {eyebrow}
            </span>
            <LiveBadge />
          </div>
          <h1 className="text-heading font-medium text-dark-graphite">
            {title}
          </h1>
          {description && (
            <p className="text-caption text-mid-gray mt-1 max-w-2xl">{description}</p>
          )}
        </div>
      </motion.header>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center gap-2 text-caption">
          <span className="text-mid-gray uppercase tracking-wider">Periodo</span>
          <span className="text-dark-graphite font-medium">{presetLabel}</span>
          <span className="text-mid-gray">·</span>
          <span className="text-graphite tabular-nums">{rangeCaption}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />
          {actions}
        </div>
      </div>
    </div>
  )
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-positive-bg px-2 h-5 rounded-full">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-positive-text opacity-60 animate-ping" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-positive-text" />
      </span>
      <span className="text-caption uppercase tracking-wider text-positive-text font-medium">
        Datos al día
      </span>
    </span>
  )
}
