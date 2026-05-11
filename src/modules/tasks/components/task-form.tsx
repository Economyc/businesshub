import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { modalVariants } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { SelectInput } from '@/core/ui/select-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useTaskMutations } from '../hooks/use-tasks'
import type { Subtask, Task, TaskInput, TaskPriority } from '../types'

interface TaskFormProps {
  open: boolean
  task: Task | null
  onClose: () => void
}

const NO_COMPANY = '__none__'

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function TaskForm({ open, task, onClose }: TaskFormProps) {
  const { companies } = useCompany()
  const { create, update, remove } = useTaskMutations()
  const isEdit = !!task

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [companyId, setCompanyId] = useState<string>(NO_COMPANY)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (task) {
      setTitle(task.title)
      setPriority(task.priority)
      setCompanyId(task.companyTag?.id ?? NO_COMPANY)
      setSubtasks(task.subtasks ?? [])
      setNote(task.note ?? '')
    } else {
      setTitle('')
      setPriority('medium')
      setCompanyId(NO_COMPANY)
      setSubtasks([])
      setNote('')
    }
  }, [open, task])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !confirmDelete) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, confirmDelete])

  const companyOptions = useMemo(
    () => [
      { value: NO_COMPANY, label: 'Sin etiqueta' },
      ...companies.map((c) => ({
        value: c.id,
        label: c.location ? `${c.name} · ${c.location}` : c.name,
      })),
    ],
    [companies]
  )

  function addSubtask() {
    setSubtasks((prev) => [...prev, { id: newId(), title: '', done: false }])
  }

  function updateSubtask(id: string, patch: Partial<Subtask>) {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return

    const selectedCompany = companies.find((c) => c.id === companyId)
    const cleanSubtasks = subtasks
      .map((s) => ({ ...s, title: s.title.trim() }))
      .filter((s) => s.title.length > 0)

    const payload: TaskInput = {
      title: title.trim(),
      status: task?.status ?? 'todo',
      priority,
      subtasks: cleanSubtasks,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(selectedCompany
        ? {
            companyTag: {
              id: selectedCompany.id,
              name: selectedCompany.name,
              ...(selectedCompany.color ? { color: selectedCompany.color } : {}),
            },
          }
        : {}),
    }

    setSaving(true)
    try {
      if (task) {
        await update.mutateAsync({ id: task.id, data: payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task) return
    await remove.mutateAsync(task.id)
    setConfirmDelete(false)
    onClose()
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20"
              onClick={saving ? undefined : onClose}
            />
            <motion.form
              variants={modalVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onSubmit={handleSubmit}
              className="relative bg-surface-elevated rounded-xl shadow-lg max-w-lg w-full mx-4 max-h-[85vh] flex flex-col border border-border"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                <h3 className="text-subheading font-semibold text-dark-graphite">
                  {isEdit ? 'Editar tarea' : 'Nueva tarea'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-md text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-caption text-mid-gray font-medium">Título</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="¿Qué necesitas hacer?"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:outline-none focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-caption text-mid-gray font-medium">Prioridad</label>
                    <SelectInput
                      value={priority}
                      onChange={(v) => setPriority(v as TaskPriority)}
                      options={PRIORITY_OPTIONS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-caption text-mid-gray font-medium">Compañía</label>
                    <SelectInput
                      value={companyId}
                      onChange={setCompanyId}
                      options={companyOptions}
                      placeholder="Sin etiqueta"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-caption text-mid-gray font-medium">Subtareas</label>
                    <button
                      type="button"
                      onClick={addSubtask}
                      className="inline-flex items-center gap-1 text-caption text-graphite hover:text-dark-graphite transition-colors"
                    >
                      <Plus size={13} strokeWidth={1.5} />
                      Añadir
                    </button>
                  </div>
                  {subtasks.length === 0 ? (
                    <p className="text-caption text-mid-gray/70 italic">Sin subtareas</p>
                  ) : (
                    <div className="space-y-1.5">
                      {subtasks.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateSubtask(s.id, { done: !s.done })}
                            aria-label={s.done ? 'Marcar pendiente' : 'Marcar completada'}
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                              s.done
                                ? 'bg-graphite border-graphite'
                                : 'border-border hover:border-graphite/60 bg-card-bg'
                            )}
                          >
                            {s.done && (
                              <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </button>
                          <input
                            type="text"
                            value={s.title}
                            onChange={(e) => updateSubtask(s.id, { title: e.target.value })}
                            placeholder="Subtarea"
                            className={cn(
                              'flex-1 px-2.5 py-1.5 rounded-md border border-input-border bg-input-bg text-body focus:outline-none focus:border-input-focus transition-colors',
                              s.done && 'text-mid-gray line-through'
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => removeSubtask(s.id)}
                            aria-label="Eliminar subtarea"
                            className="p-1.5 rounded-md text-mid-gray hover:text-negative-text hover:bg-negative-bg/40 transition-colors"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-caption text-mid-gray font-medium">Nota</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Detalles adicionales (opcional)"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:outline-none focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 transition-all resize-y min-h-[80px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border/60">
                <div>
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body text-negative-text hover:bg-negative-bg/40 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                      Eliminar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !title.trim()}
                    className="px-4 py-2 rounded-lg text-body font-medium bg-graphite text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar tarea"
        description="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
