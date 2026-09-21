import { useState } from 'react'
import { AlertTriangle, Save, RotateCcw, FileWarning, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KPICard } from '@/core/ui/kpi-card'
import { EmptyState } from '@/core/ui/empty-state'
import { Skeleton } from '@/core/ui/skeleton'
import { MonthPicker } from '@/core/ui/month-picker'
import { monthRange } from '@/core/pnl/month.ts'
import { formatCurrency } from '@/core/utils/format'
import { useClosing } from './use-closing'
import { StatementTable } from './statement-table'
import { BridgeCard } from './bridge-card'
import { AdjustmentsEditor } from './adjustments-editor'

interface ClosingViewProps {
  ym: string
  onMonthChange: (ym: string) => void
  canEdit: boolean
}

/** Cuántos días lleva calculada la base. */
function freshness(generatedAt: { toDate?: () => Date } | undefined): string | null {
  const d = generatedAt?.toDate?.()
  if (!d) return null
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  return `hace ${Math.round(hrs / 24)} días`
}

export function ClosingView({ ym, onMonthChange, canEdit }: ClosingViewProps) {
  const { snapshot, draft, setDraft, preview, dirty, discard, save, loading, error } = useClosing(ym)
  const [saveError, setSaveError] = useState<string | null>(null)
  const label = monthRange(ym).label

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={FileWarning}
        title="No se pudo cargar el cierre"
        description={error.message}
      />
    )
  }

  const handleSave = async () => {
    if (!draft) return
    setSaveError(null)
    try {
      await save.mutateAsync(draft)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar. Intenta de nuevo.')
    }
  }

  const stale = freshness(snapshot?.generatedAt)

  return (
    <div className="space-y-6">
      {/* Mes + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthPicker value={ym} onChange={onMonthChange} />
        {canEdit && (
          <div className="flex items-center gap-2">
            {dirty && (
              <Button variant="ghost" size="sm" onClick={discard} disabled={save.isPending}>
                <RotateCcw size={16} strokeWidth={1.5} className="mr-2" />
                Descartar
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!dirty || save.isPending}>
              <Save size={16} strokeWidth={1.5} className="mr-2" />
              {save.isPending ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Guardado'}
            </Button>
          </div>
        )}
      </div>

      {saveError && <p className="text-caption text-negative-text">{saveError}</p>}

      {!snapshot ? (
        <EmptyState
          icon={FileWarning}
          title={`Sin base calculada para ${label}`}
          description={`El preview necesita la base que publica el generador. Corré: node scripts/informe-mensual-negocios.mjs --month ${ym}`}
        />
      ) : (
        <>
          {/* Frescura de la base: lo único que puede diferir del .xlsx. */}
          <div className="flex flex-wrap items-center gap-2 text-caption text-mid-gray">
            <Clock size={14} strokeWidth={1.5} />
            <span>
              Base de Ecore y del POS calculada {stale ?? 'en una corrida anterior'}
              {snapshot.sales.source === 'override' && ' · venta cargada a mano (sede sin POS)'}
            </span>
            {snapshot.sales.daysMissing?.length > 0 && (
              <span className="text-warning-text">
                · POS sin datos en {snapshot.sales.daysMissing.length} día(s)
              </span>
            )}
          </div>

          {preview && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KPICard label="Ventas netas" value={preview.statement.accrued.revenue} format="currency" />
                <KPICard label="EBITDA" value={preview.statement.accrued.ebitda} format="currency" />
                <KPICard label="Utilidad neta" value={preview.statement.accrued.net} format="currency" />
                <KPICard
                  label="Caja que dejó el mes"
                  value={preview.bridge.caja}
                  format="currency"
                  tone={preview.bridge.caja < 0 ? 'negative' : 'positive'}
                />
              </div>

              {/* Gasto que probablemente falta cargar: sin esto el margen sale
                  inflado en silencio. */}
              {preview.missing.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-warning-bg px-6 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warning-text" />
                    <div className="space-y-1">
                      <p className="text-body font-medium text-warning-text">
                        Puede faltar gasto por cargar
                      </p>
                      {preview.missing.map((m) => (
                        <p key={m.key} className="text-caption text-warning-text">
                          {m.label}: {formatCurrency(m.amount)} este mes vs {formatCurrency(m.prevAmount)} el anterior
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <BridgeCard bridge={preview.bridge} monthLabel={label} />

              <div>
                <h3 className="text-subheading font-medium text-dark-graphite mb-4">
                  Estado de Resultados — {label}
                </h3>
                <StatementTable statement={preview.statement} />
              </div>
            </>
          )}

          {/* Captura */}
          {draft && (
            <div className="space-y-4">
              <h3 className="text-subheading font-medium text-dark-graphite">
                Datos del mes
              </h3>

              <AdjustmentsEditor
                title="Ajustes que no vienen de Ecore"
                description="4x1000, costos bancarios, comisiones de plataformas y provisiones sin factura."
                items={draft.manualAdjustments.items}
                source={draft.manualAdjustments.source}
                readOnly={!canEdit}
                defaultLine="fin_expense"
                onSourceChange={(source) =>
                  setDraft({ ...draft, manualAdjustments: { ...draft.manualAdjustments, source } })
                }
                onChange={(items) =>
                  setDraft({ ...draft, manualAdjustments: { ...draft.manualAdjustments, items } })
                }
              />

              <AdjustmentsEditor
                title="Ingresos no operacionales"
                description="Venta de un activo, un reintegro, una indemnización. Suman a la utilidad después del EBITDA, sin tocar la venta del mes."
                items={draft.nonOperatingIncome}
                readOnly={!canEdit}
                defaultLine="nonop_asset_sale"
                onChange={(nonOperatingIncome) => setDraft({ ...draft, nonOperatingIncome })}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
