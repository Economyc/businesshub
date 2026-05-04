import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ReactElement } from 'react'
import { chartColors } from '@/core/ui/chart-colors'

interface ChartData {
  name: string
  value: number
  value2?: number
}

interface Props {
  data: ChartData[]
  formatter: (v: number) => string
  valueLabel: string
  value2Label?: string
  tooltipContent: ReactElement
}

export default function InlineAreaChart({ data, formatter, valueLabel, value2Label, tooltipContent }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartColors.text }} />
        <YAxis tickFormatter={formatter} tick={{ fontSize: 10, fill: chartColors.text }} width={55} />
        <Tooltip content={tooltipContent} />
        <Area type="monotone" dataKey="value" name={valueLabel} stroke={chartColors.positive} fill={chartColors.positive} fillOpacity={0.1} isAnimationActive={false} />
        {value2Label && (
          <Area type="monotone" dataKey="value2" name={value2Label} stroke={chartColors.info} fill={chartColors.info} fillOpacity={0.1} isAnimationActive={false} />
        )}
        {value2Label && <Legend wrapperStyle={{ fontSize: 11 }} />}
      </AreaChart>
    </ResponsiveContainer>
  )
}
