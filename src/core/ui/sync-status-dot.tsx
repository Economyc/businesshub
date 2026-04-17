interface SyncStatusDotProps {
  loading: boolean
  lastUpdated: Date | null
  fromCache: boolean
  hasLocals?: boolean
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export function SyncStatusDot({
  loading,
  lastUpdated,
  fromCache,
  hasLocals = true,
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

  if (!lastUpdated) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-mid-gray/40"
        title="Sin datos"
        aria-label="Sin datos"
      />
    )
  }

  const timeLabel = formatTime(lastUpdated)

  if (fromCache) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-amber-500"
        title={`Cache · ${timeLabel}`}
        aria-label={`Datos en cache, actualizado ${timeLabel}`}
      />
    )
  }

  return (
    <span
      className="inline-block w-2 h-2 rounded-full bg-emerald-500"
      title={`En vivo · ${timeLabel}`}
      aria-label={`Datos en vivo, actualizado ${timeLabel}`}
    />
  )
}
