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
  trend?: 'up' | 'down'
  icon?: LucideIcon
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

export function KPICard({ label, value, format = 'number', change, trend, icon: Icon }: KPICardProps) {
  const animatedValue = useCountUp(value)

  const formattedValue = format === 'currency'
    ? formatCurrency(animatedValue)
    : format === 'percent'
      ? `${animatedValue}%`
      : animatedValue.toLocaleString('es-CO')

  return (
    <motion.div
      variants={staggerItem}
      className="bg-surface rounded-xl p-[18px] card-elevated"
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-caption uppercase tracking-wider text-mid-gray">{label}</span>
        {Icon && <Icon size={16} strokeWidth={1.5} className="text-smoke" />}
      </div>
      <div className="text-kpi font-extrabold text-dark-graphite">{formattedValue}</div>
      {change && (
        <div className={`inline-flex items-center gap-[3px] mt-1.5 text-caption px-2 py-0.5 rounded-full ${trend === 'down' ? 'bg-negative-bg text-negative-text' : 'bg-positive-bg text-positive-text'}`}>
          {trend === 'up' ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
          {change}
        </div>
      )}
    </motion.div>
  )
}
