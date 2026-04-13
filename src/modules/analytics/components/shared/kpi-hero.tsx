import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/core/utils/format'

interface KPIHeroProps {
  eyebrow?: string
  label: string
  value: number
  format?: 'currency' | 'number' | 'percent'
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: LucideIcon
  sparkline?: Array<{ value: number }>
  sparkColor?: string
  caption?: string
}

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const start = performance.now()
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(target * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

export function KPIHero({
  eyebrow = 'Indicador principal',
  label,
  value,
  format = 'currency',
  change,
  trend = 'neutral',
  icon: Icon,
  sparkline,
  sparkColor = '#5a7a5a',
  caption,
}: KPIHeroProps) {
  const animated = useCountUp(value)

  const formatted =
    format === 'currency'
      ? formatCurrency(Math.round(animated))
      : format === 'percent'
        ? `${Math.round(animated)}%`
        : Math.round(animated).toLocaleString('es-CO')

  const trendBg =
    trend === 'down'
      ? 'bg-negative-bg text-negative-text'
      : trend === 'neutral'
        ? 'bg-warning-bg text-warning-text'
        : 'bg-positive-bg text-positive-text'

  const TrendIcon = trend === 'up' ? ChevronUp : trend === 'down' ? ChevronDown : Minus

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-surface rounded-2xl card-elevated p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-mid-gray font-medium">
            {eyebrow}
          </p>
          <h3 className="text-body font-medium text-graphite mt-1">{label}</h3>
          <div className="mt-3 text-[44px] sm:text-[52px] leading-[1.05] font-extrabold tracking-tight text-dark-graphite tabular-nums">
            {formatted}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {change && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-medium ${trendBg}`}
              >
                <TrendIcon size={12} strokeWidth={2} />
                {change}
              </span>
            )}
            {caption && (
              <span className="text-caption text-mid-gray">{caption}</span>
            )}
          </div>
        </div>
        {Icon && (
          <div className="shrink-0 w-11 h-11 rounded-xl bg-bone flex items-center justify-center">
            <Icon size={20} strokeWidth={1.5} className="text-graphite" />
          </div>
        )}
      </div>

      {sparkline && sparkline.length > 1 && (
        <div className="mt-5 -mx-1 h-16 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkColor}
                strokeWidth={1.75}
                fill={`url(#spark-${label})`}
                dot={false}
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}
