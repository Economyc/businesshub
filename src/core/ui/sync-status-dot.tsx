import { HoverHint } from '@/components/ui/tooltip'

interface SyncStatusDotProps {
  loading: boolean
  lastUpdated: Date | null
  fromCache: boolean
  hasLocals?: boolean
  onRefresh?: () => void
  // `true` si detectamos que la última sincronización bajó significativamente
  // vs el resultado previo (chunks fallaron). Dot rojo pulsante avisa al
  // usuario que los números pueden no reflejar la realidad.
  degraded?: boolean
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export function SyncStatusDot({
  loading,
  lastUpdated,
  fromCache,
  hasLocals = true,
  onRefresh,
  degraded = false,
}: SyncStatusDotProps) {
  if (!hasLocals) {
    return (
      <HoverHint label="Sin POS vinculado">
        <span
          className="inline-block w-2 h-2 rounded-full bg-mid-gray/40"
          aria-label="Sin POS vinculado"
        />
      </HoverHint>
    )
  }

  if (loading) {
    return (
      <HoverHint label="Actualizando…">
        <span
          className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"
          aria-label="Actualizando"
        />
      </HoverHint>
    )
  }

  const timeLabel = lastUpdated ? formatTime(lastUpdated) : null
  // Degraded prioriza sobre fromCache: si el fetch se quedó corto (chunks
  // fallaron o guard anti-degradación se activó), mostrar dot rojo pulsante
  // con CTA a sincronizar. Pseado sobre el resto de estados porque ignora
  // la diferencia cache/live — ambos pueden estar degradados.
  const dotColor = !lastUpdated
    ? 'bg-mid-gray/40'
    : degraded
      ? 'bg-negative-text animate-pulse'
      : fromCache
        ? 'bg-amber-500'
        : 'bg-emerald-500'
  const baseTitle = !lastUpdated
    ? 'Sin datos'
    : degraded
      ? `Datos incompletos · ${timeLabel} · clic para reintentar`
      : fromCache
        ? `Cache · ${timeLabel}`
        : `En vivo · ${timeLabel}`
  const title = onRefresh && !degraded ? `${baseTitle} · clic para forzar actualización` : baseTitle

  if (!onRefresh) {
    return (
      <HoverHint label={baseTitle}>
        <span
          className={`inline-block w-2 h-2 rounded-full ${dotColor}`}
          aria-label={baseTitle}
        />
      </HoverHint>
    )
  }

  return (
    <HoverHint label={title}>
      <button
        type="button"
        onClick={onRefresh}
        className={`inline-block w-2 h-2 rounded-full ${dotColor} hover:ring-2 hover:ring-offset-1 hover:ring-mid-gray/40 transition`}
        aria-label={title}
      />
    </HoverHint>
  )
}
