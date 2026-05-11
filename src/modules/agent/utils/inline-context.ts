/**
 * Helpers para el panel embebido del Asistente (InlineAgentSheet).
 * Convierten el snapshot inyectado por la pantalla actual en strings
 * legibles para subtítulo del header y placeholder del input.
 */

const VIEW_LABELS: Record<string, string> = {
  facturacion: 'facturas',
}

function humanizeView(view: string): string {
  return VIEW_LABELS[view] ?? view
}

function readString(snapshot: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = snapshot?.[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readNumber(snapshot: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = snapshot?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function buildInlineSubtitle(module: string, snapshot: Record<string, unknown> | null | undefined): string {
  const view = readString(snapshot, 'view')
  const visibleCount = readNumber(snapshot, 'visibleCount')
  if (view && visibleCount !== null) {
    return `${module} · ${visibleCount} ${humanizeView(view)}`
  }
  return module
}

export function buildInlinePlaceholder(snapshot: Record<string, unknown> | null | undefined): string {
  const view = readString(snapshot, 'view')
  const visibleCount = readNumber(snapshot, 'visibleCount')
  if (view && visibleCount !== null && visibleCount > 0) {
    return `Pregunta sobre las ${visibleCount} ${humanizeView(view)}…`
  }
  return 'Pregunta sobre estos datos…'
}
