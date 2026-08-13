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
import { chartColors } from '@/core/ui/chart-colors'
import { usePosAnalytics } from '../hooks'
import {
  DOC_TYPE_LABELS,
  type DocCounts,
  type DocType,
} from '@/modules/pos-sync/utils/sales-calculations'

function pct(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

const DOC_TYPE_ORDER: DocType[] = ['factura', 'nota', 'boleta', 'otro']

// Rayas diagonales sobre el color base. La distinción entre facturas y notas
// NO puede depender solo del tono: los tokens funcionales del design system
// son deliberadamente apagados y los cuatro caen en la misma banda de
// luminancia (~0.16–0.20), así que para un usuario daltónico se ven casi
// iguales. El patrón sobrevive a cualquier tipo de daltonismo.
const STRIPES =
  'repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in srgb, var(--app-surface) 60%, transparent) 3px 6px)'

// Color e identidad visual FIJOS por tipo — no por posición en la lista.
// Con un índice, un mes sin facturas haría que las notas heredaran el color
// de las facturas y el mismo dato cambiaría de color entre periodos.
//
// Azul vs ámbar es el par seguro para el daltonismo rojo-verde (deuteranopia
// y protanopia, ~99% de los casos); verde/rojo, que es lo que da la paleta
// categórica por defecto, es justo el peor par posible.
const DOC_TYPE_STYLE: Record<DocType, { color: string; striped: boolean }> = {
  factura: { color: chartColors.info, striped: false },
  nota: { color: chartColors.warning, striped: true },
  boleta: { color: chartColors.neutral, striped: false },
  otro: { color: chartColors.muted, striped: true },
}

// Solo los tipos presentes en el periodo. Hoy el POS de las 4 sedes emite
// únicamente facturas y notas de venta, pero si aparece otro tipo entra solo
// y los porcentajes siguen sumando 100.
function buildDocMix(counts: DocCounts) {
  return DOC_TYPE_ORDER.filter((t) => counts[t] > 0).map((t) => ({
    type: t,
    name: DOC_TYPE_LABELS[t],
    value: counts[t],
    percentage: counts.total > 0 ? (counts[t] / counts.total) * 100 : 0,
    ...DOC_TYPE_STYLE[t],
  }))
}

export function PosDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const { presetLabel } = useDateRange()
  const {
    totals,
    docCounts,
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

  const docMix = buildDocMix(docCounts)

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

            <motion.section
              variants={staggerItem}
              className="bg-surface rounded-2xl card-elevated p-6"
            >
              {docMix.length === 0 ? (
                <EmptyChart message="Sin comprobantes en el periodo" />
              ) : (
                <>
                  <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
                    <span className="text-kpi font-semibold text-dark-graphite tabular-nums">
                      {docCounts.total.toLocaleString('es-CO')}
                    </span>
                    <span className="text-caption text-mid-gray font-medium">
                      Comprobantes · {presetLabel}
                    </span>
                  </header>

                  {/* Un paso más alta que la barra de composición (h-2): las
                      rayas de las notas necesitan alto para leerse. h-3 es lo
                      mínimo que funciona sin desbalancear las dos secciones. */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-smoke mb-2">
                    {docMix.map((slice) => (
                      <div
                        key={slice.type}
                        style={{
                          width: `${slice.percentage}%`,
                          backgroundColor: slice.color,
                          backgroundImage: slice.striped ? STRIPES : undefined,
                        }}
                      />
                    ))}
                  </div>

                  <ul className="divide-y divide-border/60">
                    {docMix.map((slice) => (
                      <RichHoverTooltip
                        key={slice.type}
                        title={slice.name}
                        accentColor={slice.color}
                        metrics={[
                          {
                            label: 'Cantidad',
                            value: slice.value.toLocaleString('es-CO'),
                            accent: true,
                          },
                          {
                            label: '% del total',
                            value: pct(slice.value, docCounts.total),
                          },
                        ]}
                        footer={`${docCounts.total.toLocaleString('es-CO')} comprobantes en total`}
                      >
                        <li className="flex items-center gap-3 py-3 text-body cursor-default hover:bg-bone/50 -mx-2 px-2 rounded-lg transition-colors">
                          {/* Mismo código visual que la barra: relleno sólido o
                              rayado. La forma es la señal que no depende del
                              tono, así que el marcador debe repetirla. */}
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0 border"
                            style={{
                              backgroundColor: slice.color,
                              backgroundImage: slice.striped ? STRIPES : undefined,
                              borderColor: slice.color,
                            }}
                            aria-hidden
                          />
                          <span className="text-graphite flex-1 min-w-0 truncate">
                            {slice.name}
                          </span>
                          <span className="text-mid-gray tabular-nums">
                            {slice.value.toLocaleString('es-CO')}
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
