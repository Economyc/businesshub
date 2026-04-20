import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Percent,
  Coins,
  Receipt,
  Ticket,
  ShoppingCart,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer, staggerItem } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { useDateRange } from '@/modules/finance/context/date-range-context'
import { SelectInput } from '@/core/ui/select-input'
import { SyncStatusDot } from '@/core/ui/sync-status-dot'
import { AnalyticsTabs } from './analytics-tabs'
import { ExportPDF } from './export-pdf'
import { ChartCard } from './shared/chart-card'
import { ChartTooltip } from './shared/chart-tooltip'
import { EmptyChart } from './shared/empty-chart'
import {
  CHART_SEMANTIC,
  CHART_AXIS_TICK,
  paletteColor,
} from './shared/chart-theme'
import { usePosAnalytics } from '../hooks'

function pct(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

const ALL_CATEGORIES_VALUE = '__all__'

export function PosDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const [productCategory, setProductCategory] = useState<string>(ALL_CATEGORIES_VALUE)
  const { presetLabel } = useDateRange()
  const {
    totals,
    topCategories,
    topProducts,
    allCategories,
    productsByCategory,
    loading,
    hasLocales,
    lastUpdated,
    fromCache,
    forceRefresh,
  } = usePosAnalytics()

  const productsToShow =
    productCategory === ALL_CATEGORIES_VALUE
      ? topProducts
      : productsByCategory[productCategory] ?? []

  const categoryOptions = [
    { value: ALL_CATEGORIES_VALUE, label: 'Todas las categorías' },
    ...allCategories.map((c) => ({ value: c, label: c })),
  ]

  const composition = [
    { name: 'Ventas netas', value: Math.max(totals.ventas - totals.impuestos, 0) },
    { name: 'Impuestos', value: totals.impuestos },
    { name: 'Propinas', value: totals.propinas },
    { name: 'Descuentos', value: totals.descuento },
  ].filter((slice) => slice.value > 0)

  const compositionTotal = composition.reduce((s, x) => s + x.value, 0)
  const compositionData = composition.map((slice) => ({
    ...slice,
    percentage: compositionTotal > 0 ? (slice.value / compositionTotal) * 100 : 0,
  }))

  const maxCategory = topCategories[0]?.amount ?? 0

  return (
    <PageTransition>
      <PageHeader title="Análisis">
        <div className="flex items-center gap-3">
          <SyncStatusDot
            loading={loading}
            lastUpdated={lastUpdated}
            fromCache={fromCache}
            hasLocals={hasLocales}
            onRefresh={forceRefresh}
          />
          <DateRangePicker />
        </div>
        <ExportPDF targetRef={dashboardRef} />
      </PageHeader>
      <AnalyticsTabs />

      {loading ? (
        <DashboardSkeleton kpiCount={6} charts={2} />
      ) : !hasLocales ? (
        <EmptyChart
          message="No hay locales POS configurados"
          hint="Configura un local en Punto de Venta para ver el análisis"
          height={320}
        />
      ) : (
        <div ref={dashboardRef} className="space-y-6">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <KPICard
              label="Ventas Netas"
              value={totals.ventas}
              format="currency"
              icon={DollarSign}
            />
            <KPICard
              label="Descuentos"
              value={totals.descuento}
              format="currency"
              change={`${pct(totals.descuento, totals.ventas)} de ventas`}
              trend="neutral"
              icon={Percent}
            />
            <KPICard
              label="Propinas"
              value={totals.propinas}
              format="currency"
              change={`${pct(totals.propinas, totals.ventas)} de ventas`}
              trend="neutral"
              icon={Coins}
            />
            <KPICard
              label="Impuestos"
              value={totals.impuestos}
              format="currency"
              change={`${pct(totals.impuestos, totals.ventas)} de ventas`}
              trend="neutral"
              icon={Receipt}
            />
            <KPICard
              label="Ticket prom."
              value={totals.ticket}
              format="currency"
              icon={Ticket}
            />
            <KPICard
              label="Comprobantes"
              value={totals.count}
              format="number"
              icon={ShoppingCart}
            />
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <motion.section
              variants={staggerItem}
              className="bg-surface rounded-2xl card-elevated p-6"
            >
              {compositionData.length === 0 ? (
                <EmptyChart message="Sin ventas en el periodo" />
              ) : (
                <>
                  <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
                    <span className="text-kpi font-semibold text-dark-graphite tabular-nums break-all">
                      {formatCurrency(compositionTotal)}
                    </span>
                    <span className="text-caption uppercase tracking-wider text-mid-gray font-medium">
                      Ticket total · {presetLabel}
                    </span>
                  </header>

                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-smoke mb-2">
                    {compositionData.map((slice, i) => (
                      <div
                        key={slice.name}
                        style={{
                          width: `${slice.percentage}%`,
                          backgroundColor: paletteColor(i),
                        }}
                      />
                    ))}
                  </div>

                  <ul className="divide-y divide-border/60">
                    {compositionData.map((slice, i) => (
                      <li
                        key={slice.name}
                        className="flex items-center gap-3 py-3 text-body"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: paletteColor(i) }}
                          aria-hidden
                        />
                        <span className="text-graphite flex-1 min-w-0 truncate">
                          {slice.name}
                        </span>
                        <span className="text-mid-gray tabular-nums">
                          {formatCurrency(slice.value)}
                        </span>
                        <span className="text-dark-graphite font-medium tabular-nums w-14 text-right">
                          {slice.percentage.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </motion.section>

            <ChartCard
              eyebrow="Top 10"
              title="Productos más vendidos"
              description="Ranking por monto total de venta en el periodo"
              action={
                allCategories.length > 0 ? (
                  <SelectInput
                    value={productCategory}
                    onChange={setProductCategory}
                    options={categoryOptions}
                    className="w-52"
                  />
                ) : undefined
              }
            >
              {productsToShow.length === 0 ? (
                <EmptyChart
                  height={200}
                  compact
                  message={
                    productCategory === ALL_CATEGORIES_VALUE
                      ? 'Sin productos vendidos'
                      : 'Sin productos en esta categoría'
                  }
                />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(productsToShow.length * 32, 240)}>
                  <BarChart
                    data={productsToShow}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_SEMANTIC.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={CHART_AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={CHART_AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={120}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          variant="single"
                          extraLine={(p) =>
                            p?.quantity != null
                              ? `${Number(p.quantity).toLocaleString('es-CO')} unidades`
                              : null
                          }
                        />
                      }
                      cursor={{ fill: CHART_SEMANTIC.muted }}
                    />
                    <Bar
                      dataKey="amount"
                      name="Venta"
                      fill={CHART_SEMANTIC.income}
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </motion.div>

          <ChartCard
            eyebrow="Top 5"
            title="Categorías con mayor venta"
            description="Suma de ítems vendidos por categoría"
          >
            {topCategories.length === 0 ? (
              <EmptyChart height={200} compact message="Sin ventas categorizadas" />
            ) : (
              <div className="space-y-3">
                {topCategories.map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: paletteColor(i) }}
                    />
                    <span className="text-body text-graphite w-20 sm:w-40 truncate">
                      {cat.category}
                    </span>
                    <div className="flex-1 h-7 bg-bone rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out"
                        style={{
                          width: `${maxCategory > 0 ? Math.max((cat.amount / maxCategory) * 100, 2) : 2}%`,
                          backgroundColor: paletteColor(i),
                          opacity: 0.75,
                        }}
                      />
                    </div>
                    <span className="text-body font-medium text-dark-graphite w-20 sm:w-28 text-right tabular-nums">
                      {formatCurrency(cat.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </PageTransition>
  )
}
