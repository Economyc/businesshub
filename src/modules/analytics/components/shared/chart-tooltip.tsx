import { formatCurrency } from '@/core/utils/format'

interface ChartTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
  variant?: 'default' | 'pie' | 'single'
  valueFormatter?: (v: number) => string
  extraLine?: (payload: any) => string | null
}

export function ChartTooltip({
  active,
  payload,
  label,
  variant = 'default',
  valueFormatter = formatCurrency,
  extraLine,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  if (variant === 'pie') {
    const item = payload[0]
    const extra = extraLine?.(item.payload) ?? (item.payload?.percentage != null
      ? `${Number(item.payload.percentage).toFixed(1)}%`
      : null)
    return (
      <div className="bg-surface border border-border rounded-lg shadow-md px-3 py-2 text-caption">
        <p className="font-medium text-dark-graphite">{item.name}</p>
        <p className="text-dark-graphite">{valueFormatter(item.value)}</p>
        {extra && <p className="text-mid-gray">{extra}</p>}
      </div>
    )
  }

  if (variant === 'single') {
    const item = payload[0]
    const extra = extraLine?.(item.payload)
    return (
      <div className="bg-surface border border-border rounded-lg shadow-md px-3 py-2 text-caption">
        {label && <p className="font-medium text-dark-graphite mb-1">{label}</p>}
        <p className="text-dark-graphite">{valueFormatter(item.value)}</p>
        {extra && <p className="text-mid-gray">{extra}</p>}
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg shadow-md px-3 py-2 text-caption">
      {label && <p className="font-medium text-dark-graphite mb-1">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.fill || entry.stroke }}>
          {entry.name}: {valueFormatter(entry.value)}
        </p>
      ))}
    </div>
  )
}
