import { useMemo, useState } from 'react'
import { BookOpen, Check, ExternalLink, Folder, Loader2, Settings2, Tag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useObsidianConfig } from '../hooks/use-obsidian-config'
import {
  buildMarkdown,
  buildNotePath,
  saveNoteToObsidian,
  type SaveNoteArgs,
  type SaveNoteResult,
} from '../utils/obsidian-client'
import { ObsidianConfigDialog } from './obsidian-config-dialog'

interface SaveToObsidianCardProps {
  args: Record<string, unknown>
  onConfirm: (result: SaveNoteResult) => void
  onCancel: () => void
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>
  }
  return undefined
}

export function SaveToObsidianCard({ args, onConfirm, onCancel }: SaveToObsidianCardProps) {
  const config = useObsidianConfig()
  const [configOpen, setConfigOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<SaveNoteResult | null>(null)

  const noteArgs = useMemo<SaveNoteArgs>(
    () => ({
      title: asString(args.title, 'Nota sin título'),
      content: asString(args.content),
      folder: asString(args.folder, 'Inbox/auto'),
      tags: asStringArray(args.tags),
      frontmatter: asRecord(args.frontmatter),
    }),
    [args],
  )

  const path = useMemo(() => buildNotePath(noteArgs), [noteArgs])
  const markdown = useMemo(() => buildMarkdown(noteArgs), [noteArgs])
  const isHttps = config.endpoint.toLowerCase().startsWith('https://')

  async function handleSave() {
    setLoading(true)
    setError(null)
    const result = await saveNoteToObsidian(
      { endpoint: config.endpoint, token: config.token },
      noteArgs,
    )
    setLoading(false)
    if (result.ok) {
      setDone(result)
      onConfirm(result)
    } else {
      setError(result.error ?? 'No se pudo guardar la nota.')
    }
  }

  return (
    <>
      <div className="mx-4 my-2 rounded-xl border border-border/60 bg-card-bg p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-bone text-graphite">
            <BookOpen size={14} strokeWidth={1.5} />
          </div>
          <span className="text-subheading font-medium text-dark-graphite">
            Guardar en Obsidian
          </span>
        </div>

        {/* Title */}
        <div className="mb-4">
          <p className="text-caption text-mid-gray font-medium mb-1">Título</p>
          <p className="text-body text-dark-graphite font-medium">{noteArgs.title}</p>
        </div>

        {/* Folder + path */}
        <div className="mb-4 flex items-start gap-2">
          <Folder size={14} strokeWidth={1.5} className="text-mid-gray mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-mid-gray font-medium mb-1">Destino</p>
            <p className="text-caption text-graphite font-mono break-all">{path}</p>
          </div>
        </div>

        {/* Tags */}
        {noteArgs.tags && noteArgs.tags.length > 0 && (
          <div className="mb-4 flex items-start gap-2">
            <Tag size={14} strokeWidth={1.5} className="text-mid-gray mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-mid-gray font-medium mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {noteArgs.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-bone text-caption text-graphite"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Frontmatter compact */}
        {noteArgs.frontmatter && Object.keys(noteArgs.frontmatter).length > 0 && (
          <div className="mb-4">
            <p className="text-caption text-mid-gray font-medium mb-2">Propiedades</p>
            <div className="rounded-lg border border-border/60 bg-surface p-4 space-y-1">
              {Object.entries(noteArgs.frontmatter).map(([key, value]) => (
                <div key={key} className="flex items-baseline gap-2 text-caption">
                  <span className="text-mid-gray font-medium min-w-[80px] shrink-0">{key}</span>
                  <span className="text-graphite truncate">
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content preview */}
        <div className="mb-4">
          <p className="text-caption text-mid-gray font-medium mb-2">Vista previa</p>
          <div className="rounded-lg border border-border/60 bg-surface p-4 max-h-[200px] overflow-y-auto">
            <pre className="text-caption text-graphite whitespace-pre-wrap font-mono leading-relaxed">
              {markdown}
            </pre>
          </div>
        </div>

        {/* Endpoint state */}
        {!config.isConfigured && !done && (
          <div className="mb-4 rounded-lg border border-border/60 bg-warning-bg p-4">
            <p className="text-caption text-warning-text mb-2">
              No has configurado el endpoint de Obsidian todavía.
            </p>
            <button
              onClick={() => setConfigOpen(true)}
              className="inline-flex items-center gap-1.5 text-caption font-medium text-warning-text hover:underline"
            >
              <Settings2 size={12} strokeWidth={1.5} />
              Configurar endpoint
            </button>
          </div>
        )}

        {config.isConfigured && !done && (
          <div className="mb-4 rounded-lg border border-border/60 bg-surface p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 text-caption">
              <span className="text-mid-gray">Endpoint</span>
              <span className="text-graphite font-mono truncate">{config.endpoint}</span>
            </div>
            {isHttps && (
              <p className="text-caption text-mid-gray">
                Si usas HTTPS local, abre el endpoint una vez en otra pestaña para aceptar el certificado autofirmado.
              </p>
            )}
            <p className="text-caption text-mid-gray">
              Si tu navegador bloquea por CORS, agrega el origen de BusinessHub a la lista de permitidos del plugin.
            </p>
            <button
              onClick={() => setConfigOpen(true)}
              className="inline-flex items-center gap-1.5 text-caption font-medium text-mid-gray hover:text-graphite"
            >
              <Settings2 size={12} strokeWidth={1.5} />
              Cambiar configuración
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-border/60 bg-negative-bg p-4">
            <p className="text-caption text-negative-text break-words">{error}</p>
            {isHttps && (
              <a
                href={config.endpoint}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-negative-text hover:underline"
              >
                Abrir endpoint y aceptar certificado
                <ExternalLink size={12} strokeWidth={1.5} />
              </a>
            )}
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="mb-4 rounded-lg border border-border/60 bg-positive-bg p-4">
            <p className="text-caption text-positive-text font-medium">
              Nota guardada en {done.path}
            </p>
          </div>
        )}

        {/* Actions */}
        {!done && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={loading || !config.isConfigured}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body font-medium transition-colors',
                'bg-dark-graphite text-white hover:opacity-90',
                (loading || !config.isConfigured) && 'opacity-60 cursor-not-allowed',
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Check size={14} />
                  Guardar nota
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body font-medium text-mid-gray hover:text-dark-graphite hover:bg-bone transition-colors"
            >
              <X size={14} />
              Cancelar
            </button>
          </div>
        )}
      </div>

      <ObsidianConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </>
  )
}
