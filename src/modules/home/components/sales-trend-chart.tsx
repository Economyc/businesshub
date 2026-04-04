import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/core/utils/format'
import type { SalesTrendPoint } from '../hooks'

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      <p className="text-emerald-600">Ventas: {formatCurrency(payload[0].value)}</p>
    </div>
  )
}

interface SalesTrendChartProps {
  data: SalesTrendPoint[]
  periodLabel: string
}

export function SalesTrendChart({ data, periodLabel }: SalesTrendChartProps) {
  const hasData = data.some((d) => d.sales > 0)

  return (
    <div className="bg-surface rounded-xl card-elevated p-[18px]">
      <h2 className="text-body font-bold text-dark-graphite mb-3">Ventas — {periodLabel}</h2>
      {!hasData ? (
        <div className="flex items-center justify-center h-[150px] sm:h-[200px] text-mid-gray text-caption">
          Sin datos de ventas en este período
        </div>
      ) : (
        <div className="h-[150px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#8a8a8a' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(v)}
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
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
