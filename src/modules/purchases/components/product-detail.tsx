import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { formatCurrency } from '@/core/utils/format'
import { useProduct, useProductPriceHistory } from '../hooks'

const COLORS = ['#3d3d3d', '#5a7a5a', '#9a6a6a', '#6a6a9a', '#9a8a5a', '#5a8a8a', '#8a5a7a']

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 text-caption">
      <p className="font-medium text-dark-graphite mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.fill || entry.stroke }}>
          {entry.name}: {typeof entry.value === 'number' && entry.value > 100 ? formatCurrency(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

export function ProductDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: product, loading: productLoading } = useProduct(id)
  const { priceData, loading: priceLoading } = useProductPriceHistory(id)

  const loading = productLoading || priceLoading

  if (loading) {
    return (
      <PageTransition>
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      </PageTransition>
    )
  }

  if (!product) {
    return (
      <PageTransition>
        <div className="text-body text-mid-gray py-8 text-center">Insumo no encontrado.</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mb-4">
        <button
          onClick={() => navigate('/finance/purchases/products')}
          className="flex items-center gap-1.5 text-body text-mid-gray hover:text-graphite transition-colors duration-150"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Volver a Insumos
        </button>
      </div>

      <PageHeader title={product.name} />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-surface rounded-xl p-[18px] card-elevated">
          <span className="text-caption uppercase tracking-wider text-mid-gray">Precio Promedio</span>
          <div className="text-kpi font-semibold text-dark-graphite mt-1">{formatCurrency(priceData.avgPrice)}</div>
        </div>
        <div className="bg-surface rounded-xl p-[18px] card-elevated">
          <span className="text-caption uppercase tracking-wider text-mid-gray">Precio Mínimo</span>
          <div className="text-kpi font-semibold text-positive-text mt-1">{formatCurrency(priceData.minPrice)}</div>
        </div>
        <div className="bg-surface rounded-xl p-[18px] card-elevated">
          <span className="text-caption uppercase tracking-wider text-mid-gray">Precio Máximo</span>
          <div className="text-kpi font-semibold text-negative-text mt-1">{formatCurrency(priceData.maxPrice)}</div>
        </div>
        <div className="bg-surface rounded-xl p-[18px] card-elevated">
          <span className="text-caption uppercase tracking-wider text-mid-gray">Último Precio</span>
          <div className="text-kpi font-semibold text-dark-graphite mt-1">{formatCurrency(priceData.lastPrice)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Price History Chart */}
        <div className="bg-surface rounded-xl card-elevated p-6">
          <h2 className="text-subheading font-medium text-dark-graphite mb-4">Historial de Precios</h2>
          {priceData.history.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-body text-mid-gray">Sin datos de compra</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={priceData.history} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="price" name="Precio" stroke="#3d3d3d" strokeWidth={2} dot={{ r: 3, fill: '#3d3d3d' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Supplier Comparison */}
        <div className="bg-surface rounded-xl card-elevated p-6">
          <h2 className="text-subheading font-medium text-dark-graphite mb-4">Comparación entre Proveedores</h2>
          {priceData.supplierComparison.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-body text-mid-gray">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={priceData.supplierComparison.map((s) => ({
                  name: s.supplierName.length > 15 ? s.supplierName.slice(0, 15) + '...' : s.supplierName,
                  avgPrice: s.avgPrice,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal vertical={false} strokeDasharray="3 3" stroke="#eeece9" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f4f2' }} />
                <Bar dataKey="avgPrice" name="Precio Promedio" barSize={20} radius={[0, 6, 6, 0]}>
                  {priceData.supplierComparison.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Consumption by Month */}
      {priceData.consumptionByMonth.length > 0 && (
        <div className="bg-surface rounded-xl card-elevated p-6 mb-5">
          <h2 className="text-subheading font-medium text-dark-graphite mb-4">Consumo Mensual ({product.unit})</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={priceData.consumptionByMonth} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eeece9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f4f2' }} />
              <Bar dataKey="quantity" name="Cantidad" fill="#5a7a5a" barSize={24} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Supplier Detail Table */}
      {priceData.supplierComparison.length > 0 && (
        <div className="bg-surface rounded-xl card-elevated p-6">
          <h2 className="text-subheading font-medium text-dark-graphite mb-4">Detalle por Proveedor</h2>
          <table className="w-full text-body">
            <thead>
              <tr className="text-caption uppercase tracking-wider text-mid-gray border-b border-border">
                <th className="text-left py-2 pr-4">Proveedor</th>
                <th className="text-right py-2 px-4">Precio Promedio</th>
                <th className="text-right py-2 px-4">Último Precio</th>
                <th className="text-right py-2 pl-4"># Compras</th>
              </tr>
            </thead>
            <tbody>
              {priceData.supplierComparison.map((s, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2.5 pr-4 text-graphite font-medium">{s.supplierName}</td>
                  <td className="py-2.5 px-4 text-right text-graphite">{formatCurrency(s.avgPrice)}</td>
                  <td className="py-2.5 px-4 text-right text-graphite">{formatCurrency(s.lastPrice)}</td>
                  <td className="py-2.5 pl-4 text-right text-graphite">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageTransition>
  )
}
