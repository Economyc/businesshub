import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ReactElement } from 'react'

interface ChartData {
  name: string
  value: number
}

interface Props {
  data: ChartData[]
  colors: string[]
  tooltipContent: ReactElement
}

export default function InlinePieChart({ data, colors, tooltipContent }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
          fontSize={9}
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={colors[data.indexOf(entry) % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={tooltipContent} />
      </PieChart>
    </ResponsiveContainer>
  )
}
