import { useMemo, useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Database, Building2 } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { formatCurrency } from '@/core/utils/format'
import { listCachedMonths, type CachedMonthStats } from '../cache-service'
import { rebuildCacheMonth, type RebuildMonthResult } from '../services'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Row extends CachedMonthStats {
  id: string
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const label = MONTH_LABELS[m - 1] ?? month
  return `${label} ${y}`
}

// Semáforo del mes. Por encima de 99% consideramos completo — hay días con
// cero ventas legítimos (cerrado) que stampEmpty deja sin aparecer en
// `days`; 100% exacto es raro salvo rebuild inmediato.
function completenessTone(pct: number): 'ok' | 'warn' | 'danger' {
  if (pct >= 0.99) return 'ok'
  if (pct >= 0.5) return 'warn'
  return 'danger'
}

const TONE_CLASSES: Record<'ok' | 'warn' | 'danger', string> = {
  ok: 'bg-positive-bg text-positive-text',
  warn: 'bg-warning-bg text-warning-text',
  danger: 'bg-negative-bg text-negative-text',
}

function timeAgo(date: Date | null): string {
  if (!date) return '—'
  const diffMs = Date.now() - date.getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const hr = Math.round(min / 60)
  if (hr < 24) return `hace ${hr} h`
  const days = Math.round(hr / 24)
  if (days < 30) return `hace ${days} d`
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CacheStatusTab() {
  const { selectedCompany } = useCompany()
  const { isAdmin } = usePermissions()
  const companyId = selectedCompany?.id ?? null
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['pos-cache-months', companyId],
    queryFn: async () => (companyId ? listCachedMonths(companyId) : []),
    enabled: !!companyId,
    staleTime: 30_000,
  })

  const [rebuildingMonth, setRebuildingMonth] = useState<string | null>(null)
  const [confirmMonth, setConfirmMonth] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<RebuildMonthResult | null>(null)
  const [rebuildError, setRebuildError] = useState<string | null>(null)

  const handleRebuild = useCallback(async () => {
    if (!companyId || !confirmMonth) return
    const month = confirmMonth
    setConfirmMonth(null)
    setRebuildingMonth(month)
    setRebuildError(null)
    setLastResult(null)
    try {
      const res = await rebuildCacheMonth(companyId, month)
      setLastResult(res)
      // Invalidar queries de ventas para que la UI muestre datos frescos.
      queryClient.invalidateQueries({ queryKey: ['pos-cache-months'] })
      queryClient.invalidateQueries({ queryKey: ['pos-ventas'] })
      queryClient.invalidateQueries({ queryKey: ['home-sales'] })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setRebuildError(msg)
    } finally {
      setRebuildingMonth(null)
    }
  }, [companyId, confirmMonth, queryClient])

  const rows: Row[] = useMemo(
    () => (query.data ?? []).map((s) => ({ ...s, id: s.month })),
    [query.data],
  )

  const columns: Column<Row>[] = useMemo(
    () => [
      {
        key: 'month',
        header: 'Mes',
        width: '1.5fr',
        primary: true,
        render: (r) => <span className="text-body font-semibold text-graphite">{formatMonth(r.month)}</span>,
      },
      {
        key: 'days',
        header: 'Días',
        width: '0.8fr',
        render: (r) => (
          <span className="text-body text-graphite tabular-nums">
            {r.daysWithData} / {r.daysExpected}
          </span>
        ),
      },
      {
        key: 'ventasTotal',
        header: 'Ventas',
        width: '1.2fr',
        render: (r) => (
          <div className="flex flex-col items-start">
            <span className="text-body font-semibold text-dark-graphite tabular-nums">
              {formatCurrency(r.ventasTotal)}
            </span>
            <span className="text-caption text-mid-gray tabular-nums">
              {r.ventasCount.toLocaleString('es-CO')} ventas
            </span>
          </div>
        ),
      },
      {
        key: 'completeness',
        header: 'Completitud',
        width: '1fr',
        render: (r) => {
          const tone = completenessTone(r.completeness)
          const pct = Math.round(r.completeness * 100)
          return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption font-semibold ${TONE_CLASSES[tone]}`}>
              {tone === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {pct}%
            </span>
          )
        },
      },
      {
        key: 'lastSync',
        header: 'Última sincronización',
        width: '1fr',
        hideOnMobile: true,
        render: (r) => <span className="text-body text-mid-gray">{timeAgo(r.lastSync)}</span>,
      },
      {
        key: 'actions',
        header: 'Acciones',
        width: '1fr',
        render: (r) => {
          if (!isAdmin) return <span className="text-caption text-mid-gray">—</span>
          const isBusy = rebuildingMonth === r.month
          const anyBusy = rebuildingMonth !== null
          return (
            <button
              onClick={() => setConfirmMonth(r.month)}
              disabled={anyBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bone hover:bg-bone/70 disabled:opacity-50 text-caption font-semibold text-graphite transition-colors"
              title="Purga el cache del mes y lo vuelve a descargar del POS en ventanas de 15 días"
            >
              {isBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {isBusy ? 'Reconstruyendo…' : 'Reconstruir'}
            </button>
          )
        },
      },
    ],
    [isAdmin, rebuildingMonth],
  )

  // Limpia el resumen cuando el usuario navega o cambia de company.
  useEffect(() => {
    setLastResult(null)
    setRebuildError(null)
  }, [companyId])

  if (!companyId) {
    return (
      <EmptyState
        icon={Building2}
        title="Selecciona una company"
        description="No hay company activa."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-2xl card-elevated border border-bone/60 p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <div>
            <h2 className="text-heading font-semibold text-dark-graphite">Estado del caché POS</h2>
            <p className="text-body text-mid-gray mt-1 max-w-2xl">
              Cada mes se guarda en Firestore para evitar pegarle al POS en cada carga. Si un mes
              aparece con menos del 100% de días, el POS lo devolvió parcial cuando se cacheó por
              primera vez. Reconstruir borra ese mes y lo redescarga con ventanas de 15 días.
            </p>
          </div>
          {!isAdmin && (
            <span className="text-caption text-mid-gray">
              Solo administradores pueden reconstruir meses.
            </span>
          )}
        </div>
      </div>

      {query.isLoading && (
        <div className="bg-surface rounded-2xl card-elevated border border-bone/60 p-6 flex items-center gap-2 text-mid-gray">
          <Loader2 size={14} className="animate-spin" />
          Cargando meses cacheados…
        </div>
      )}

      {query.error && (
        <div className="bg-negative-bg text-negative-text rounded-xl p-4 text-body">
          Error al leer el caché: {(query.error as Error).message}
        </div>
      )}

      {!query.isLoading && rows.length === 0 && (
        <EmptyState
          icon={Database}
          title="Sin meses cacheados"
          description="Todavía no hay ventas cacheadas para esta company."
        />
      )}

      {rows.length > 0 && <DataTable columns={columns} data={rows} />}

      {lastResult && (
        <div className="bg-positive-bg text-positive-text rounded-xl p-4 text-body">
          <div className="font-semibold">
            {formatMonth(lastResult.month)} reconstruido · {lastResult.ventasWritten.toLocaleString('es-CO')} ventas
          </div>
          <div className="text-caption mt-1">
            {lastResult.salesDocsDeleted} docs purgados · {lastResult.windowsProcessed} ventanas ·
            {' '}{(lastResult.durationMs / 1000).toFixed(1)}s
            {lastResult.rateLimited && ' · rate-limit alcanzado'}
          </div>
        </div>
      )}

      {rebuildError && (
        <div className="bg-negative-bg text-negative-text rounded-xl p-4 text-body">
          No se pudo reconstruir: {rebuildError}
        </div>
      )}

      <Dialog open={confirmMonth !== null} onOpenChange={(open: boolean) => !open && setConfirmMonth(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconstruir {confirmMonth ? formatMonth(confirmMonth) : ''}</DialogTitle>
            <DialogDescription>
              Esto borrará todo el caché de este mes y lo volverá a descargar desde el POS en
              ventanas de 15 días. Puede tardar 2–5 minutos según el volumen. Durante la
              operación, la página de ventas podría mostrar datos vacíos transitoriamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMonth(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRebuild}>Reconstruir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
