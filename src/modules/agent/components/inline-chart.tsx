import { lazy, Suspense, useMemo } from 'react'
import { chartColors } from '@/core/ui/chart-colors'

// Cada tipo de chart vive en su propio archivo y se carga lazy. Esto evita
// que el chunk de agent-page contenga el barrel completo de recharts (Bar +
// Pie + Area + Line + sus deps = ~150K). Solo se descarga el chart que el
// agente acaba de pedir.
const BarChart = lazy(() => import('./inline-chart-bar'))
const PieChart = lazy(() => import('./inline-chart-pie'))
const AreaChart = lazy(() => import('./inline-chart-area'))
const LineChart = lazy(() => import('./inline-chart-line'))

interface ChartData {
  name: string
  value: number
  value2?: number
}

interface InlineChartProps {
  chartType: 'bar' | 'pie' | 'area' | 'line'
  title: string
  data: ChartData[]
  valueLabel?: string
  value2Label?: string
  formatAsCurrency?: boolean
}

const PIE_COLORS = [
  chartColors.positive,
  chartColors.info,
  chartColors.warning,
  chartColors.negative,
  chartColors.neutral,
  chartColors.foreground,
]

function formatCLP(value: number): string {
  return `$${value.toLocaleString('es-CL')}`
}

function CustomTooltip({ active, payload, label, formatAsCurrency }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  formatAsCurrency: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-elevated border border-border/60 rounded-lg px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatAsCurrency ? formatCLP(entry.value) : entry.value.toLocaleString('es-CL')}
        </p>
      ))}
    </div>
  )
}

function ChartFallback() {
  return <div className="h-[220px] w-full animate-pulse rounded bg-bone/40" />
}

export function InlineChart({ chartType, title, data, valueLabel = 'Valor', value2Label, formatAsCurrency = true }: InlineChartProps) {
  const formatter = useMemo(() => {
    return formatAsCurrency ? (v: number) => formatCLP(v) : (v: number) => v.toLocaleString('es-CL')
  }, [formatAsCurrency])

  const tooltip = <CustomTooltip formatAsCurrency={formatAsCurrency} />

  return (
    <div className="mx-4 my-2 rounded-xl border border-border/60 bg-card-bg p-4">
      <h4 className="text-body font-medium text-dark-graphite mb-3">{title}</h4>
      <Suspense fallback={<ChartFallback />}>
        {chartType === 'pie' ? (
          <PieChart data={data} colors={PIE_COLORS} tooltipContent={tooltip} />
        ) : chartType === 'bar' ? (
          <BarChart data={data} formatter={formatter} valueLabel={valueLabel} value2Label={value2Label} tooltipContent={tooltip} />
        ) : chartType === 'area' ? (
          <AreaChart data={data} formatter={formatter} valueLabel={valueLabel} value2Label={value2Label} tooltipContent={tooltip} />
        ) : (
          <LineChart data={data} formatter={formatter} valueLabel={valueLabel} value2Label={value2Label} tooltipContent={tooltip} />
        )}
      </Suspense>
    </div>
  )
}
