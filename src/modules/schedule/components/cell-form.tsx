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
import type {
  Shift,
  ShiftFormData,
  ShiftTemplate,
  Novelty,
  NoveltyFormData,
  NoveltyType,
} from '../types'
import {
  useCreateShift,
  useUpdateShift,
  useRemoveShift,
  useCreateNovelty,
  useUpdateNovelty,
  useRemoveNovelty,
} from '../hooks'
import { shiftHours, formatHours } from './schedule-utils'
import { NOVELTY_COLORS } from './novelty-colors'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption text-mid-gray mb-1.5'

type Mode = 'shift' | 'novelty'

interface Props {
  open: boolean
  onClose: () => void
  weekKey: string
  date: string // 'YYYY-MM-DD'
  employee: Employee
  shift?: Shift // presente = edición de turno
  novelty?: Novelty // presente = edición de novedad
  templates: ShiftTemplate[]
  noveltyTypes: NoveltyType[]
  dayShifts: Shift[] // turnos del empleado ese día (para el reemplazo al crear novedad)
  onSaved: () => void
}

// Editor de lo que va en una celda (empleado × día): un turno o una novedad. Al
// crear muestra un toggle "Turno | Novedad"; al editar, el modo queda fijo según
// lo que se haya clickeado. Una novedad REEMPLAZA los turnos del día.
export function CellForm({
  open,
  onClose,
  weekKey,
  date,
  employee,
  shift,
  novelty,
  templates,
  noveltyTypes,
  dayShifts,
  onSaved,
}: Props) {
  const editingShift = !!shift
  const editingNovelty = !!novelty
  const isEdit = editingShift || editingNovelty

  const [mode, setMode] = useState<Mode>(editingNovelty ? 'novelty' : 'shift')

  // Campos de turno
  const [start, setStart] = useState(shift?.start ?? '08:00')
  const [end, setEnd] = useState(shift?.end ?? '16:00')
  const [breakMin, setBreakMin] = useState(String(shift?.breakMin ?? 0))
  const [notes, setNotes] = useState(shift?.notes ?? '')

  // Campos de novedad
  const [typeId, setTypeId] = useState(novelty?.typeId ?? noveltyTypes[0]?.id ?? '')
  const [noveltyNotes, setNoveltyNotes] = useState(novelty?.notes ?? '')

  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const createShift = useCreateShift()
  const updateShift = useUpdateShift()
  const removeShift = useRemoveShift()
  const createNovelty = useCreateNovelty()
  const updateNovelty = useUpdateNovelty()
  const removeNovelty = useRemoveNovelty()

  const saving =
    createShift.isPending ||
    updateShift.isPending ||
    createNovelty.isPending ||
    updateNovelty.isPending ||
    removeShift.isPending
  const deleting = removeShift.isPending || removeNovelty.isPending

  function applyTemplate(t: ShiftTemplate) {
    setStart(t.start)
    setEnd(t.end)
    setBreakMin(String(t.breakMin ?? 0))
  }

  // ── Turno ──
  async function saveShift() {
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
    }
    try {
      if (editingShift) {
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

  // ── Novedad ──
  async function saveNovelty() {
    const selectedType = noveltyTypes.find((t) => t.id === typeId)
    if (!selectedType) {
      setError('Selecciona un tipo de novedad')
      return
    }
    const data: NoveltyFormData = {
      weekKey,
      date,
      employeeId: employee.id,
      typeId: selectedType.id,
      typeName: selectedType.name,
      color: selectedType.color,
      ...(noveltyNotes.trim() ? { notes: noveltyNotes.trim() } : {}),
    }
    try {
      if (editingNovelty) {
        await updateNovelty.mutateAsync({ id: novelty!.id, data })
      } else {
        // Una novedad reemplaza el día: borra los turnos existentes antes de crearla.
        if (dayShifts.length > 0) {
          await Promise.all(dayShifts.map((s) => removeShift.mutateAsync(s.id)))
        }
        await createNovelty.mutateAsync(data)
      }
      onSaved()
      onClose()
    } catch {
      setError('No se pudo guardar la novedad')
    }
  }

  function handleSave() {
    setError('')
    if (mode === 'shift') {
      saveShift()
      return
    }
    // Novedad nueva sobre un día con turnos → confirmar reemplazo antes de guardar.
    if (!editingNovelty && dayShifts.length > 0 && !confirmReplace) {
      if (!noveltyTypes.find((t) => t.id === typeId)) {
        setError('Selecciona un tipo de novedad')
        return
      }
      setConfirmReplace(true)
      return
    }
    saveNovelty()
  }

  async function handleDelete() {
    setError('')
    try {
      if (editingNovelty) {
        await removeNovelty.mutateAsync(novelty!.id)
      } else {
        await removeShift.mutateAsync(shift!.id)
      }
      onSaved()
      onClose()
    } catch {
      setError('No se pudo eliminar')
    }
  }

  const hours = start && end ? shiftHours(start, end, Number(breakMin) || 0) : 0
  const title = editingShift
    ? 'Editar turno'
    : editingNovelty
      ? 'Editar novedad'
      : 'Nuevo'

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-caption text-mid-gray">
            {employee.name}
            {employee.department ? ` · ${employee.department}` : ''}
          </p>
        </DialogHeader>

        {/* Toggle Turno/Novedad: solo al crear */}
        {!isEdit && (
          <div className="flex gap-1 rounded-lg border border-border/60 p-1">
            <button
              type="button"
              onClick={() => { setMode('shift'); setError(''); setConfirmReplace(false) }}
              className={
                'flex-1 rounded-md py-1.5 text-caption transition-colors ' +
                (mode === 'shift' ? 'bg-graphite text-bone' : 'text-mid-gray hover:text-graphite')
              }
            >
              Turno
            </button>
            <button
              type="button"
              onClick={() => { setMode('novelty'); setError(''); setConfirmReplace(false) }}
              className={
                'flex-1 rounded-md py-1.5 text-caption transition-colors ' +
                (mode === 'novelty' ? 'bg-graphite text-bone' : 'text-mid-gray hover:text-graphite')
              }
            >
              Novedad
            </button>
          </div>
        )}

        {mode === 'shift' ? (
          <>
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
          </>
        ) : (
          <>
            <div>
              <span className={labelClass}>Tipo de novedad</span>
              {noveltyTypes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {noveltyTypes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTypeId(t.id)}
                      className={
                        'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-caption transition-colors ' +
                        (typeId === t.id
                          ? NOVELTY_COLORS[t.color].chip
                          : 'border-border/60 text-graphite hover:bg-graphite/5')
                      }
                    >
                      <span className={`size-2.5 rounded-full ${NOVELTY_COLORS[t.color]?.swatch ?? ''}`} />
                      {t.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-caption text-mid-gray">
                  El Owner aún no creó tipos de novedad.
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Notas (opcional)</label>
              <input
                type="text"
                value={noveltyNotes}
                onChange={(e) => setNoveltyNotes(e.target.value)}
                placeholder="Ej: cita médica"
                className={inputClass}
              />
            </div>
          </>
        )}

        {error && <p className="text-caption text-negative-text">{error}</p>}

        <DialogFooter>
          {confirmDelete ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center w-full">
              <span className="text-caption text-negative-text sm:mr-auto">
                ¿Eliminar {editingNovelty ? 'esta novedad' : 'este turno'}? No se puede deshacer.
              </span>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="size-4" />
                {deleting ? 'Eliminando…' : 'Sí, eliminar'}
              </Button>
            </div>
          ) : confirmReplace ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center w-full">
              <span className="text-caption text-warning-text sm:mr-auto">
                Este día tiene {dayShifts.length} turno{dayShifts.length === 1 ? '' : 's'}. La novedad lo{dayShifts.length === 1 ? '' : 's'} reemplazará.
              </span>
              <Button variant="outline" onClick={() => setConfirmReplace(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={saveNovelty} disabled={saving}>
                {saving ? 'Guardando…' : 'Sí, reemplazar'}
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
              <Button onClick={handleSave} disabled={saving || (mode === 'novelty' && noveltyTypes.length === 0)}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
