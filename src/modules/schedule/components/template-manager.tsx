import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ShiftTemplate, ShiftTemplateFormData } from '../types'
import { useCreateTemplate, useRemoveTemplate } from '../hooks'
import { shiftHours, formatHours, formatShiftRange } from './schedule-utils'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption text-mid-gray mb-1.5'

interface Props {
  open: boolean
  onClose: () => void
  templates: ShiftTemplate[]
  onChanged: () => void
}

export function TemplateManager({ open, onClose, templates, onChanged }: Props) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('16:00')
  const [breakMin, setBreakMin] = useState('0')
  const [error, setError] = useState('')

  const createTemplate = useCreateTemplate()
  const removeTemplate = useRemoveTemplate()

  async function handleAdd() {
    if (!name.trim()) { setError('Ponle un nombre a la plantilla'); return }
    if (!start || !end || start === end) { setError('Revisa las horas de inicio y fin'); return }
    const brk = Math.max(0, Number(breakMin) || 0)
    const data: ShiftTemplateFormData = {
      name: name.trim(),
      start,
      end,
      ...(brk > 0 ? { breakMin: brk } : {}),
    }
    try {
      await createTemplate.mutateAsync(data)
      setName('')
      setError('')
      onChanged()
    } catch {
      setError('No se pudo crear la plantilla')
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeTemplate.mutateAsync(id)
      onChanged()
    } catch {
      setError('No se pudo eliminar la plantilla')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plantillas de turno</DialogTitle>
          <p className="text-caption text-mid-gray">
            Atajos reutilizables (ej: "Mañana 8-16") que prellenan el turno y puedes ajustar.
          </p>
        </DialogHeader>

        {templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="text-body text-graphite">{t.name}</p>
                  <p className="text-caption text-mid-gray">
                    {formatShiftRange(t.start, t.end)} · {formatHours(shiftHours(t.start, t.end, t.breakMin))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(t.id)}
                  className="p-2 rounded-lg text-mid-gray hover:text-negative-text hover:bg-graphite/5 transition-colors"
                  aria-label="Eliminar plantilla"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-caption text-mid-gray">Aún no hay plantillas.</p>
        )}

        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <p className="text-caption text-mid-gray">Nueva plantilla</p>
          <div>
            <label className={labelClass}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mañana"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Inicio</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Fin</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Descanso</label>
              <input type="number" min={0} step={15} value={breakMin} onChange={(e) => setBreakMin(e.target.value)} className={inputClass} />
            </div>
          </div>
          {error && <p className="text-caption text-negative-text">{error}</p>}
          <Button onClick={handleAdd} disabled={createTemplate.isPending} className="w-full">
            <Plus className="size-4" />
            Agregar plantilla
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
