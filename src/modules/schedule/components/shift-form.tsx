import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Employee } from '@/modules/talent/types'
import type { Shift, ShiftFormData, ShiftTemplate } from '../types'
import { useCreateShift, useUpdateShift, useRemoveShift } from '../hooks'
import { shiftHours, formatHours } from './schedule-utils'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption text-mid-gray mb-1.5'

interface Props {
  open: boolean
  onClose: () => void
  weekKey: string
  date: string // 'YYYY-MM-DD'
  employee: Employee
  shift?: Shift // presente = edición
  templates: ShiftTemplate[]
  onSaved: () => void
}

export function ShiftForm({ open, onClose, weekKey, date, employee, shift, templates, onSaved }: Props) {
  const isEdit = !!shift
  const [start, setStart] = useState(shift?.start ?? '08:00')
  const [end, setEnd] = useState(shift?.end ?? '16:00')
  const [breakMin, setBreakMin] = useState(String(shift?.breakMin ?? 0))
  const [notes, setNotes] = useState(shift?.notes ?? '')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const createShift = useCreateShift()
  const updateShift = useUpdateShift()
  const removeShift = useRemoveShift()
  const saving = createShift.isPending || updateShift.isPending
  const deleting = removeShift.isPending

  function applyTemplate(t: ShiftTemplate) {
    setStart(t.start)
    setEnd(t.end)
    setBreakMin(String(t.breakMin ?? 0))
  }

  async function handleSave() {
    if (!start || !end) {
      setError('Hora de inicio y fin son obligatorias')
      return
    }
    if (start === end) {
      setError('La hora de fin no puede ser igual a la de inicio')
      return
    }
    const brk = Math.max(0, Number(breakMin) || 0)
    const data: ShiftFormData = {
      weekKey,
      date,
      employeeId: employee.id,
      start,
      end,
      ...(brk > 0 ? { breakMin: brk } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(employee.role ? { role: employee.role } : {}),
    }
    try {
      if (isEdit) {
        await updateShift.mutateAsync({ id: shift!.id, data })
      } else {
        await createShift.mutateAsync(data)
      }
      onSaved()
      onClose()
    } catch {
      setError('No se pudo guardar el turno')
    }
  }

  async function handleDelete() {
    try {
      await removeShift.mutateAsync(shift!.id)
      onSaved()
      onClose()
    } catch {
      setError('No se pudo eliminar el turno')
    }
  }

  const hours = start && end ? shiftHours(start, end, Number(breakMin) || 0) : 0

  return (
      <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar turno' : 'Nuevo turno'}</DialogTitle>
            <p className="text-caption text-mid-gray">
              {employee.name}
              {employee.role ? ` · ${employee.role}` : ''}
            </p>
          </DialogHeader>

          {templates.length > 0 && (
            <div>
              <span className={labelClass}>Plantilla</span>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="rounded-lg border border-border/60 px-2.5 py-1.5 text-caption text-graphite transition-colors hover:bg-graphite/5"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Inicio</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Fin</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className={labelClass}>Descanso (min)</label>
              <input
                type="number"
                min={0}
                step={15}
                value={breakMin}
                onChange={(e) => setBreakMin(e.target.value)}
                className={inputClass}
              />
            </div>
            <p className="text-caption text-mid-gray pb-2.5">
              Total: <span className="text-graphite">{formatHours(hours)}</span>
            </p>
          </div>

          <div>
            <label className={labelClass}>Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: cubre apertura"
              className={inputClass}
            />
          </div>

          {error && <p className="text-caption text-negative-text">{error}</p>}

          <DialogFooter>
            {confirmDelete ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center w-full">
                <span className="text-caption text-negative-text sm:mr-auto">
                  ¿Eliminar este turno? No se puede deshacer.
                </span>
                <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  <Trash2 className="size-4" />
                  {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                </Button>
              </div>
            ) : (
              <>
                {isEdit && (
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    className="sm:mr-auto"
                  >
                    <Trash2 className="size-4" />
                    Eliminar
                  </Button>
                )}
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}
