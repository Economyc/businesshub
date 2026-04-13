import type { LucideIcon } from 'lucide-react'
import { BarChart3 } from 'lucide-react'

interface EmptyChartProps {
  message?: string
  hint?: string
  icon?: LucideIcon
  height?: number | string
  compact?: boolean
}

export function EmptyChart({
  message = 'Sin datos en este período',
  hint = 'Ajusta el rango para visualizar información',
  icon: Icon = BarChart3,
  height = 280,
  compact = false,
}: EmptyChartProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-center"
      style={{ height }}
    >
      <div className="w-10 h-10 rounded-full bg-bone flex items-center justify-center">
        <Icon size={18} strokeWidth={1.5} className="text-mid-gray" />
      </div>
      <p className="text-caption text-graphite font-medium">{message}</p>
      {!compact && <p className="text-caption text-mid-gray">{hint}</p>}
    </div>
  )
}
