import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import type { DeliveryReportData } from '../hooks/use-delivery-report-data'

/** Avisos de carga del POS: sin conexión, error, límite de consultas y progreso. */
export function ReportDataStatus({ data }: { data: DeliveryReportData }) {
  // El error va primero: si falló la consulta de locales al POS, `hasLocals` también
  // es false y el aviso de "sin local asignado" culparía a la configuración.
  if (data.error) {
    return (
      <div className="bg-negative-bg text-negative-text rounded-xl px-4 py-3 text-body mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div>No se pudieron cargar las ventas del POS.</div>
            <div className="text-caption mt-1 opacity-80">{data.error}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={data.refetch}
          className="shrink-0 flex items-center gap-2 rounded-lg border border-negative-text/30 px-3 py-1.5 text-caption hover:bg-negative-text/10 transition"
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      </div>
    )
  }

  if (!data.localsLoading && !data.hasLocals) {
    return (
      <div className="bg-warning-bg text-warning-text rounded-xl px-4 py-3 text-body mb-4">
        Esta compañía no tiene un local del POS asignado, así que no hay ventas para los informes.
      </div>
    )
  }

  if (data.rateLimited) {
    return (
      <div className="bg-warning-bg text-warning-text rounded-xl px-4 py-3 text-body mb-4">
        El POS está limitando las consultas. Las cifras pueden estar incompletas; reintenta en unos minutos.
      </div>
    )
  }

  if (data.loading && data.progress && data.progress.total > 1) {
    return (
      <div className="bg-info-bg text-info-text rounded-xl px-4 py-3 text-body mb-4 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        Trayendo ventas del POS ({data.progress.current} de {data.progress.total} tramos)…
      </div>
    )
  }

  return null
}
