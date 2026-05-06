import { useState, useMemo } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Sparkles, X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentChatEmbedded } from './agent-chat-embedded'

interface InlineAgentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Snapshot del contexto que el usuario tiene en pantalla. */
  contextSnapshot?: Record<string, unknown> | null
  /** Etiqueta legible del modulo (ej. "Finanzas"). */
  module: string
  /** Sugerencias rapidas que se envian directo como prompt al hacer click. */
  suggestions?: string[]
}

const MAX_CONTEXT_ROWS = 6

function formatSnapshotValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toLocaleString('es-CO')
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  try {
    const json = JSON.stringify(value)
    return json.length > 80 ? json.slice(0, 80) + '…' : json
  } catch {
    return String(value)
  }
}

function flattenForDisplay(snapshot: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(snapshot).map(([key, value]) => ({
    key,
    value: formatSnapshotValue(value),
  }))
}

/**
 * Sheet lateral derecho que aloja el asistente AI con contexto inyectado de la
 * pantalla actual. Sigue DESIGN_SYSTEM: borde 1px sin shadow, tipografia en la
 * escala permitida, colores via tokens, spacing en multiplos de 4.
 *
 * Reusa @base-ui/react/dialog porque ya esta instalado (es la base de
 * `src/components/ui/dialog.tsx`). El popup esta posicionado a la derecha y
 * ocupa pantalla completa en mobile, ~480px en desktop.
 */
export function InlineAgentSheet({
  open,
  onOpenChange,
  contextSnapshot,
  module,
  suggestions = [],
}: InlineAgentSheetProps) {
  const [contextExpanded, setContextExpanded] = useState(false)
  // Cuando el sheet se cierra y vuelve a abrir con otro snapshot, reusamos el
  // mismo AgentChatEmbedded. Para no mezclar conversaciones cambiamos la key.
  const [chatKey, setChatKey] = useState(0)

  const flattened = useMemo(() => {
    if (!contextSnapshot) return []
    return flattenForDisplay(contextSnapshot)
  }, [contextSnapshot])

  const visibleRows = flattened.slice(0, MAX_CONTEXT_ROWS)
  const hiddenCount = Math.max(0, flattened.length - MAX_CONTEXT_ROWS)

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Al cerrar, marcamos el chat para reset en la proxima apertura.
      setChatKey((k) => k + 1)
      setContextExpanded(false)
    }
    onOpenChange(next)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs',
            'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex flex-col bg-surface',
            'w-full sm:w-[480px] max-w-full',
            'border-l border-border outline-none',
            'data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right-8',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-8',
            'duration-150',
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border/60">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-bone flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={16} strokeWidth={1.5} className="text-graphite" />
              </div>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-subheading font-medium text-dark-graphite">
                  Asistente AI
                </DialogPrimitive.Title>
                <p className="text-caption text-mid-gray truncate">{module}</p>
              </div>
            </div>
            <DialogPrimitive.Close
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              aria-label="Cerrar"
            >
              <X size={16} strokeWidth={1.5} />
            </DialogPrimitive.Close>
          </div>

          {/* Contexto colapsable + sugerencias */}
          {(flattened.length > 0 || suggestions.length > 0) && (
            <div className="px-6 py-4 border-b border-border/60 space-y-4">
              {flattened.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setContextExpanded((v) => !v)}
                    className="flex items-center gap-1.5 text-caption font-medium text-mid-gray uppercase tracking-wide hover:text-graphite transition-colors"
                  >
                    {contextExpanded ? (
                      <ChevronDown size={12} strokeWidth={2} />
                    ) : (
                      <ChevronRight size={12} strokeWidth={2} />
                    )}
                    Contexto
                    <span className="text-mid-gray normal-case tracking-normal font-normal">
                      ({flattened.length})
                    </span>
                  </button>
                  {contextExpanded && (
                    <ul className="mt-2 space-y-1">
                      {visibleRows.map(({ key, value }) => (
                        <li key={key} className="flex items-start gap-2 text-caption">
                          <span className="text-mid-gray shrink-0">{key}:</span>
                          <span className="text-graphite truncate">{value}</span>
                        </li>
                      ))}
                      {hiddenCount > 0 && (
                        <li className="text-caption text-mid-gray italic">
                          + {hiddenCount} campos más
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              {suggestions.length > 0 && (
                <div>
                  <p className="text-caption font-medium text-mid-gray uppercase tracking-wide mb-2">
                    Sugerencias rápidas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <SuggestionPill key={s} text={s} chatKey={chatKey} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chat embebido */}
          <div className="flex-1 flex flex-col min-h-0">
            <AgentChatEmbedded
              key={chatKey}
              inlineContext={contextSnapshot ?? null}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Pill clickeable que dispara una sugerencia. Como AgentChatEmbedded maneja
 * su propio estado interno, las sugerencias se delegan via un evento
 * personalizado en el documento, escuchado por el chat embebido.
 *
 * Implementacion alternativa: pasar un ref/callback a AgentChatEmbedded. Por
 * ahora el evento mantiene el componente desacoplado del sheet.
 */
function SuggestionPill({ text, chatKey }: { text: string; chatKey: number }) {
  function handleClick() {
    const event = new CustomEvent('inline-agent:suggestion', {
      detail: { text, chatKey },
    })
    window.dispatchEvent(event)
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'px-3 py-1.5 rounded-full border border-border/60 bg-card-bg',
        'text-caption text-graphite',
        'hover:bg-bone hover:border-border-hover transition-colors',
        'active:scale-95',
      )}
    >
      {text}
    </button>
  )
}
