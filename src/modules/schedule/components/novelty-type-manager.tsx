import { useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { NoveltyColor, NoveltyType, NoveltyTypeFormData } from '../types'
import { useCreateNoveltyType, useRemoveNoveltyType } from '../hooks'
import { NOVELTY_COLORS, NOVELTY_COLOR_KEYS, DEFAULT_NOVELTY_COLOR } from './novelty-colors'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption text-mid-gray mb-1.5'

interface Props {
  open: boolean
  onClose: () => void
  noveltyTypes: NoveltyType[]
  onChanged: () => void
}

// Gestor del catálogo de tipos de novedad ("Cumpleaños", "Descanso", etc.).
// Solo se monta para el Owner (el gating vive en schedule-view). Mismo patrón
// visual que TemplateManager pero con selector de color en vez de horas.
export function NoveltyTypeManager({ open, onClose, noveltyTypes, onChanged }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<NoveltyColor>(DEFAULT_NOVELTY_COLOR)
  const [error, setError] = useState('')

  const createType = useCreateNoveltyType()
  const removeType = useRemoveNoveltyType()

  async function handleAdd() {
    if (!name.trim()) {
      setError('Ponle un nombre a la novedad')
      return
    }
    const data: NoveltyTypeFormData = { name: name.trim(), color }
    try {
      await createType.mutateAsync(data)
      setName('')
      setColor(DEFAULT_NOVELTY_COLOR)
      setError('')
      onChanged()
    } catch {
      setError('No se pudo crear el tipo de novedad')
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeType.mutateAsync(id)
      onChanged()
    } catch {
      setError('No se pudo eliminar el tipo de novedad')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Plantillas de novedades</DialogTitle>
          <p className="text-caption text-mid-gray">
            Tipos de novedad (ej: "Cumpleaños", "Descanso", "Incapacidad") que los administradores ubican en el horario. Solo tú puedes crearlos o eliminarlos.
          </p>
        </DialogHeader>

        {noveltyTypes.length > 0 ? (
          <div className="space-y-2">
            {noveltyTypes.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`size-3 rounded-full ${NOVELTY_COLORS[t.color]?.swatch ?? ''}`} />
                  <p className="text-body text-graphite">{t.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(t.id)}
                  className="p-2 rounded-lg text-mid-gray hover:text-negative-text hover:bg-graphite/5 transition-colors"
                  aria-label="Eliminar tipo de novedad"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-caption text-mid-gray">Aún no hay tipos de novedad.</p>
        )}

        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <p className="text-caption text-mid-gray">Nuevo tipo</p>
          <div>
            <label className={labelClass}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cumpleaños"
              className={inputClass}
            />
          </div>
          <div>
            <span className={labelClass}>Color</span>
            <div className="flex flex-wrap gap-2">
              {NOVELTY_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-label={NOVELTY_COLORS[key].label}
                  className={
                    `flex items-center justify-center size-8 rounded-full ${NOVELTY_COLORS[key].swatch} transition-all ` +
                    (color === key ? 'ring-2 ring-offset-2 ring-offset-surface ring-graphite/40' : 'hover:opacity-80')
                  }
                >
                  {color === key && <Check className="size-4 text-bone" strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-caption text-negative-text">{error}</p>}
          <Button onClick={handleAdd} disabled={createType.isPending} className="w-full">
            <Plus className="size-4" />
            Agregar tipo
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
