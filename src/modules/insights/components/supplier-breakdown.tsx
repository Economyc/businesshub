import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/core/utils/format'
import type { SupplierBreakdownData } from '../types'

interface SupplierBreakdownProps {
  data: SupplierBreakdownData[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      <p className="text-dark-graphite">
        {formatCurrency(payload[0].value)}
      </p>
      {payload[0]?.payload?.count != null && (
        <p className="text-mid-gray">{payload[0].payload.count} compras</p>
      )}
    </div>
  )
}

export function SupplierBreakdown({ data }: SupplierBreakdownProps) {
  const chartHeight = Math.max(200, data.length * 48)

  return (
    <div className="bg-surface rounded-xl card-elevated p-6">
      <h2 className="text-subheading font-medium text-dark-graphite mb-4">Compras por Proveedor</h2>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" stroke="#eeece9" />
          <XAxis
            type="number"
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fontSize: 11, fill: '#8a8a8a' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: '#8a8a8a' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f4f2' }} />
          <Bar
            dataKey="total"
            fill="#6a7a9a"
            barSize={20}
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
