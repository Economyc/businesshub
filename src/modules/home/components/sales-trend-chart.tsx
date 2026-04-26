import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/core/utils/format'
import { chartColors } from '@/core/ui/chart-colors'
import type { SalesTrendPoint } from '../hooks'

interface TrendRow {
  date: string
  sales: number | null
  projected: number | null
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as TrendRow | undefined
  const realValue = row?.sales
  const projectedValue = row?.projected
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      {typeof realValue === 'number' && (
        <p className="text-emerald-600">Real: {formatCurrency(realValue)}</p>
      )}
      {typeof projectedValue === 'number' && realValue == null && (
        <p className="text-mid-gray">Proyectado: {formatCurrency(projectedValue)}</p>
      )}
    </div>
  )
}

interface SalesTrendChartProps {
  data: SalesTrendPoint[]
  startDate: Date
  endDate: Date
  projection?: SalesTrendPoint[]
}

function monthYearLabel(d: Date): string {
  const month = d.toLocaleDateString('es-CO', { month: 'long' })
  const capitalized = month.charAt(0).toUpperCase() + month.slice(1)
  return `${capitalized} ${d.getFullYear()}`
}

function formatRangeMonthYear(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  if (sameMonth) return monthYearLabel(end)
  if (sameYear) {
    const startMonth = start.toLocaleDateString('es-CO', { month: 'long' })
    const startCap = startMonth.charAt(0).toUpperCase() + startMonth.slice(1)
    const endMonth = end.toLocaleDateString('es-CO', { month: 'long' })
    const endCap = endMonth.charAt(0).toUpperCase() + endMonth.slice(1)
    return `${startCap} a ${endCap} ${end.getFullYear()}`
  }
  return `${monthYearLabel(start)} a ${monthYearLabel(end)}`
}

export function SalesTrendChart({ data, startDate, endDate, projection }: SalesTrendChartProps) {
  const hasData = data.some((d) => d.sales > 0)
  const hasProjection = !!projection && projection.length > 0
  const periodLabel = formatRangeMonthYear(startDate, endDate)

  // Merge real + proyección en filas. Último punto real se duplica en `projected`
  // para que la línea punteada arranque pegada a la real sin dejar hueco visual.
  const rows: TrendRow[] = data.map((d) => ({
    date: d.date,
    sales: d.sales,
    projected: null,
  }))
  if (hasProjection && rows.length > 0) {
    const lastReal = rows[rows.length - 1]
    lastReal.projected = lastReal.sales
    for (const p of projection!) {
      rows.push({ date: p.date, sales: null, projected: p.sales })
    }
  }

  return (
    <div className="bg-surface rounded-xl card-elevated p-[18px]">
      <h2 className="text-body font-bold text-dark-graphite mb-3">Ventas — {periodLabel}</h2>
      {!hasData ? (
        <div className="flex items-center justify-center h-[150px] sm:h-[200px] text-mid-gray text-caption">
          Sin datos de ventas en este período
        </div>
      ) : (
        <div className="h-[150px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <AreaChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#8a8a8a' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) =>
                `$${Number(v).toLocaleString('es-CO', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                })}`
              }
              tick={{ fontSize: 11, fill: '#8a8a8a' }}
              axisLine={false}
              tickLine={false}
              width={54}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#5a7a5a"
              fill="#5a7a5a"
              fillOpacity={0.1}
              strokeWidth={2}
              connectNulls={false}
            />
            {hasProjection && (
              <Area
                type="monotone"
                dataKey="projected"
                stroke={chartColors.neutral}
                fill={chartColors.neutral}
                fillOpacity={0.05}
                strokeWidth={2}
                strokeDasharray="4 4"
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
