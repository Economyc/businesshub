interface SyncStatusDotProps {
  loading: boolean
  lastUpdated: Date | null
  fromCache: boolean
  hasLocals?: boolean
  onRefresh?: () => void
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
}: SyncStatusDotProps) {
  if (!hasLocals) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-mid-gray/40"
        title="Sin POS vinculado"
        aria-label="Sin POS vinculado"
      />
    )
  }

  if (loading) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"
        title="Actualizando…"
        aria-label="Actualizando"
      />
    )
  }

  const timeLabel = lastUpdated ? formatTime(lastUpdated) : null
  const dotColor = !lastUpdated
    ? 'bg-mid-gray/40'
    : fromCache
      ? 'bg-amber-500'
      : 'bg-emerald-500'
  const baseTitle = !lastUpdated
    ? 'Sin datos'
    : fromCache
      ? `Cache · ${timeLabel}`
      : `En vivo · ${timeLabel}`
  const title = onRefresh ? `${baseTitle} · clic para forzar actualización` : baseTitle

  if (!onRefresh) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${dotColor}`}
        title={baseTitle}
        aria-label={baseTitle}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={onRefresh}
      className={`inline-block w-2 h-2 rounded-full ${dotColor} hover:ring-2 hover:ring-offset-1 hover:ring-mid-gray/40 transition`}
      title={title}
      aria-label={title}
    />
  )
}
