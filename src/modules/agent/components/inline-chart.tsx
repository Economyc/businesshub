import { useMemo } from 'react'
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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

const COLORS = ['#5a7a5a', '#7a9a7a', '#4a6a4a', '#8aaa8a', '#3a5a3a', '#6a8a6a', '#9aba9a', '#2a4a2a']

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
    <div className="bg-white border border-border/60 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatAsCurrency ? formatCLP(entry.value) : entry.value.toLocaleString('es-CL')}
        </p>
      ))}
    </div>
  )
}

export function InlineChart({ chartType, title, data, valueLabel = 'Valor', value2Label, formatAsCurrency = true }: InlineChartProps) {
  const formatter = useMemo(() => {
    return formatAsCurrency ? (v: number) => formatCLP(v) : (v: number) => v.toLocaleString('es-CL')
  }, [formatAsCurrency])

  return (
    <div className="mx-4 my-2 rounded-xl border border-border/60 bg-card-bg p-4">
      <h4 className="text-xs font-semibold text-dark-graphite mb-3">{title}</h4>

      <ResponsiveContainer width="100%" height={220}>
        {chartType === 'pie' ? (
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
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip formatAsCurrency={formatAsCurrency} />} />
          </PieChart>
        ) : chartType === 'bar' ? (
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8a8a8a' }} />
            <YAxis tickFormatter={formatter} tick={{ fontSize: 10, fill: '#8a8a8a' }} width={55} />
            <Tooltip content={<CustomTooltip formatAsCurrency={formatAsCurrency} />} />
            <Bar dataKey="value" name={valueLabel} fill="#5a7a5a" radius={[4, 4, 0, 0]} />
            {value2Label && (
              <Bar dataKey="value2" name={value2Label} fill="#7a9a7a" radius={[4, 4, 0, 0]} />
            )}
            {value2Label && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </BarChart>
        ) : chartType === 'area' ? (
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8a8a8a' }} />
            <YAxis tickFormatter={formatter} tick={{ fontSize: 10, fill: '#8a8a8a' }} width={55} />
            <Tooltip content={<CustomTooltip formatAsCurrency={formatAsCurrency} />} />
            <Area type="monotone" dataKey="value" name={valueLabel} stroke="#5a7a5a" fill="#5a7a5a" fillOpacity={0.1} />
            {value2Label && (
              <Area type="monotone" dataKey="value2" name={value2Label} stroke="#7a9a7a" fill="#7a9a7a" fillOpacity={0.1} />
            )}
            {value2Label && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8a8a8a' }} />
            <YAxis tickFormatter={formatter} tick={{ fontSize: 10, fill: '#8a8a8a' }} width={55} />
            <Tooltip content={<CustomTooltip formatAsCurrency={formatAsCurrency} />} />
            <Line type="monotone" dataKey="value" name={valueLabel} stroke="#5a7a5a" strokeWidth={2} dot={{ r: 3 }} />
            {value2Label && (
              <Line type="monotone" dataKey="value2" name={value2Label} stroke="#7a9a7a" strokeWidth={2} dot={{ r: 3 }} />
            )}
            {value2Label && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
