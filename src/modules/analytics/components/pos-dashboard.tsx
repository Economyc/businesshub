import { useRef } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Percent,
  Coins,
  Receipt,
  Ticket,
  ShoppingCart,
} from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer, staggerItem } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { DateRangePicker } from '@/core/ui/date-range-picker'
import { useDateRange } from '@/core/ui/date-range-context'
import { SyncStatusDot } from '@/core/ui/sync-status-dot'
import { ExportPDF } from './export-pdf'
import { EmptyChart } from './shared/empty-chart'
import { paletteColor } from './shared/chart-theme'
import { RichHoverTooltip } from './shared/rich-hover-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import { usePosAnalytics } from '../hooks'

function pct(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

export function PosDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { presetLabel } = useDateRange()
  const {
    totals,
    loading,
    hasLocales,
    lastUpdated,
    fromCache,
    forceRefresh,
  } = usePosAnalytics()

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

      {loading ? (
        <DashboardSkeleton kpiCount={6} charts={1} />
      ) : !hasLocales ? (
        <EmptyChart
          message="No hay locales POS configurados"
          hint="Configura un local en Punto de Venta para ver el análisis"
          height={320}
        />
      ) : (
        <TooltipProvider delayDuration={120} skipDelayDuration={200}>
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
            className="grid grid-cols-1 gap-6"
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
                    <span className="text-caption text-mid-gray font-medium">
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
                      <RichHoverTooltip
                        key={slice.name}
                        title={slice.name}
                        accentColor={paletteColor(i)}
                        metrics={[
                          {
                            label: 'Monto',
                            value: formatCurrency(slice.value),
                            accent: true,
                          },
                          {
                            label: '% del total',
                            value: `${slice.percentage.toFixed(1)}%`,
                          },
                        ]}
                        footer={`Ticket total ${formatCurrency(compositionTotal)}`}
                      >
                        <li className="flex items-center gap-3 py-3 text-body cursor-default hover:bg-bone/50 -mx-2 px-2 rounded-lg transition-colors">
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
                      </RichHoverTooltip>
                    ))}
                  </ul>
                </>
              )}
            </motion.section>
          </motion.div>
        </div>
        </TooltipProvider>
      )}
    </PageTransition>
  )
}
