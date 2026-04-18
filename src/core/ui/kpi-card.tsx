import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { staggerItem } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: number
  format?: 'number' | 'currency' | 'percent'
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  comparison?: string
  icon?: LucideIcon
  inverse?: boolean
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const from = 0

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(from + (target - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [target, duration])

  return count
}

export function KPICard({ label, value, format = 'number', change, trend, comparison, icon: Icon, inverse = false }: KPICardProps) {
  const animatedValue = useCountUp(value)

  const formattedValue = format === 'currency'
    ? formatCurrency(animatedValue)
    : format === 'percent'
      ? `${animatedValue}%`
      : animatedValue.toLocaleString('es-CO')

  return (
    <motion.div
      variants={staggerItem}
      className="bg-surface rounded-xl p-3 sm:p-[18px] card-elevated overflow-hidden"
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-caption uppercase tracking-wider text-mid-gray truncate mr-1">{label}</span>
        {Icon && <Icon size={16} strokeWidth={1.5} className="text-smoke" />}
      </div>
      <div className="text-lg sm:text-kpi font-extrabold text-dark-graphite truncate">{formattedValue}</div>
      {(change || comparison) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {change && (
            <span className={`inline-flex items-center gap-[3px] text-caption px-2 py-0.5 rounded-full ${trend === 'neutral' ? 'bg-warning-bg text-warning-text' : (inverse ? trend === 'up' : trend === 'down') ? 'bg-negative-bg text-negative-text' : 'bg-positive-bg text-positive-text'}`}>
              {trend === 'up' ? <ChevronUp size={12} strokeWidth={1.5} /> : trend === 'down' ? <ChevronDown size={12} strokeWidth={1.5} /> : null}
              {change}
            </span>
          )}
          {comparison && (
            <span className="text-caption text-mid-gray truncate">{comparison}</span>
          )}
        </div>
      )}
    </motion.div>
  )
}
