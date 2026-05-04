import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ReactElement } from 'react'

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

export default function InlineLineChart({ data, formatter, valueLabel, value2Label, tooltipContent }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8a8a8a' }} />
        <YAxis tickFormatter={formatter} tick={{ fontSize: 10, fill: '#8a8a8a' }} width={55} />
        <Tooltip content={tooltipContent} />
        <Line type="monotone" dataKey="value" name={valueLabel} stroke="#5a7a5a" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        {value2Label && (
          <Line type="monotone" dataKey="value2" name={value2Label} stroke="#7a9a7a" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        )}
        {value2Label && <Legend wrapperStyle={{ fontSize: 11 }} />}
      </LineChart>
    </ResponsiveContainer>
  )
}
