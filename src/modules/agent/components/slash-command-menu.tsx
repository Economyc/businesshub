import { useEffect, useMemo, useRef } from 'react'
import { CornerDownLeft, Slash } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  filterSlashCommands,
  type SlashCommand,
} from '../utils/slash-commands'

interface SlashCommandMenuProps {
  open: boolean
  query: string
  /** Indice activo controlado por el padre (para navegacion con teclado). */
  activeIndex: number
  /** Notifica al padre cuantos items hay tras filtrar (para clamp del activeIndex). */
  onResultsChange?: (commands: SlashCommand[]) => void
  onSelect: (cmd: SlashCommand) => void
  onHoverIndex?: (index: number) => void
}

/**
 * Menu flotante de comandos. Se ancla al input por absolute (el contenedor
 * padre debe ser `relative`). Sigue DESIGN_SYSTEM.md: borde 1px, sin sombras,
 * tipografia en escalas, paleta bone/graphite.
 */
export function SlashCommandMenu({
  open,
  query,
  activeIndex,
  onResultsChange,
  onSelect,
  onHoverIndex,
}: SlashCommandMenuProps) {
  const commands = useMemo(() => filterSlashCommands(query), [query])
  const lastReportedRef = useRef<SlashCommand[] | null>(null)

  useEffect(() => {
    if (!onResultsChange) return
    if (lastReportedRef.current === commands) return
    lastReportedRef.current = commands
    onResultsChange(commands)
  }, [commands, onResultsChange])

  if (!open) return null

  return (
    <div
      role="listbox"
      aria-label="Comandos rápidos"
      className={cn(
        'absolute bottom-full left-0 mb-2 w-80 z-30',
        'rounded-lg border border-border/60 bg-bone overflow-hidden',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <Slash size={12} strokeWidth={1.5} className="text-mid-gray" />
        <span className="text-caption text-mid-gray">
          Comandos rápidos
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto p-1">
        {commands.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-caption text-mid-gray">
              Sin coincidencias para "/{query}"
            </p>
          </div>
        ) : (
          commands.map((cmd, idx) => {
            const isActive = idx === activeIndex
            return (
              <button
                key={cmd.name}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  // Evita perder el foco del textarea antes del onClick.
                  e.preventDefault()
                }}
                onMouseEnter={() => onHoverIndex?.(idx)}
                onClick={() => onSelect(cmd)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                  isActive
                    ? 'bg-card-bg text-dark-graphite'
                    : 'text-graphite hover:bg-card-bg/60',
                )}
              >
                <span className="shrink-0 mt-0.5 text-mid-gray">
                  <Slash size={12} strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-medium text-dark-graphite truncate">
                      /{cmd.name}
                    </span>
                    <span className="text-caption text-mid-gray truncate">
                      {cmd.label}
                    </span>
                  </div>
                  <div className="text-caption text-muted-foreground truncate">
                    {cmd.description}
                  </div>
                </div>
                {isActive && (
                  <CornerDownLeft
                    size={12}
                    strokeWidth={1.5}
                    className="shrink-0 mt-1 text-mid-gray"
                  />
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
