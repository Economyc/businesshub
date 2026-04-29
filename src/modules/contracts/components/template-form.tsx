import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Plus } from 'lucide-react'
import { SelectInput } from '@/core/ui/select-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { HoverHint } from '@/components/ui/tooltip'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { modalVariants } from '@/core/animations/variants'
import { templateService } from '../services'
import { ClauseEditor } from './clause-editor'
import { getDefaultTemplates } from '../defaults/templates'
import type { ContractTemplate, ClauseDefinition } from '../types'
import type { ContractType } from '@/core/types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

const CONTRACT_TYPE_OPTIONS = [
  { value: 'indefinido', label: 'Término Indefinido' },
  { value: 'fijo', label: 'Término Fijo' },
  { value: 'obra_labor', label: 'Obra o Labor' },
  { value: 'aprendizaje', label: 'Aprendizaje' },
  { value: 'prestacion_servicios', label: 'Prestación de Servicios' },
]

interface TemplateFormProps {
  open: boolean
  onClose: () => void
  template?: ContractTemplate | null
}

export function TemplateForm({ open, onClose, template }: TemplateFormProps) {
  const { selectedCompany } = useCompany()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isEditing = !!template

  const saveMutation = useFirestoreMutation(
    'contract_templates',
    async (companyId: string, data: any) => {
      const { id, ...rest } = data
      if (id) await templateService.update(companyId, id, rest)
      else await templateService.create(companyId, rest)
    },
  )

  const deleteMutation = useFirestoreMutation(
    'contract_templates',
    (companyId: string, id: string) => templateService.remove(companyId, id),
    { optimisticDelete: true },
  )

  const [form, setForm] = useState({
    name: '',
    contractType: 'indefinido' as ContractType,
    position: '',
    description: '',
  })
  const [clauses, setClauses] = useState<ClauseDefinition[]>([])

  useEffect(() => {
    if (open && template) {
      setForm({
        name: template.name,
        contractType: template.contractType,
        position: template.position,
        description: template.description,
      })
      setClauses([...template.clauses].sort((a, b) => a.order - b.order))
    } else if (open && !template) {
      resetForm()
    }
  }, [open, template?.id])

  function resetForm() {
    setForm({ name: '', contractType: 'indefinido', position: '', description: '' })
    setClauses([])
  }

  function loadDefaultTemplate(index: number) {
    const defaults = getDefaultTemplates()
    if (index >= 0 && index < defaults.length) {
      const d = defaults[index]
      setForm({ name: d.name, contractType: d.contractType, position: d.position, description: d.description })
      setClauses([...d.clauses].sort((a, b) => a.order - b.order))
    }
  }

  function handleClauseChange(idx: number, updated: ClauseDefinition) {
    setClauses((prev) => prev.map((c, i) => (i === idx ? updated : c)))
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return
    setClauses((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next.map((c, i) => ({ ...c, order: i + 1 }))
    })
  }

  function handleMoveDown(idx: number) {
    setClauses((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next.map((c, i) => ({ ...c, order: i + 1 }))
    })
  }

  function handleDeleteClause(idx: number) {
    setClauses((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i + 1 })))
  }

  function addClause() {
    const newClause: ClauseDefinition = {
      id: `clause_custom_${Date.now()}`,
      title: '',
      content: '',
      isRequired: false,
      isEditable: true,
      order: clauses.length + 1,
      category: 'optional',
    }
    setClauses((prev) => [...prev, newClause])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    const data = {
      ...form,
      clauses: clauses.map((c, i) => ({ ...c, order: i + 1 })),
      isDefault: template?.isDefault ?? false,
    }
    await saveMutation.mutateAsync(isEditing ? { id: template.id, ...data } : data)
    resetForm()
    onClose()
  }

  async function handleDelete() {
    if (!selectedCompany || !template) return
    await deleteMutation.mutateAsync(template.id)
    setDeleteOpen(false)
    resetForm()
    onClose()
  }

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function handleCancel() {
    resetForm()
    setDeleteOpen(false)
    onClose()
  }

  const defaultTemplates = getDefaultTemplates()

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
              onClick={handleCancel}
            />
            <motion.div
              variants={modalVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-4xl mx-4 border border-border max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
                <h2 className="text-subheading font-semibold text-dark-graphite">
                  {isEditing ? 'Editar Plantilla' : 'Nueva Plantilla'}
                </h2>
                <button
                  onClick={handleCancel}
                  className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 p-6">
                  {/* Base template loader */}
                  {!isEditing && clauses.length === 0 && (
                    <div className="mb-5 p-4 bg-bone/50 rounded-xl border border-border">
                      <label className={labelClass}>Cargar plantilla base</label>
                      <select
                        onChange={(e) => {
                          const idx = parseInt(e.target.value)
                          if (!isNaN(idx)) loadDefaultTemplate(idx)
                        }}
                        defaultValue=""
                        className={inputClass}
                      >
                        <option value="" disabled>Seleccionar plantilla predeterminada...</option>
                        {defaultTemplates.map((dt, i) => (
                          <option key={i} value={i}>{dt.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Basic info */}
                  <div className="grid grid-cols-2 gap-5 mb-6">
                    <div className="col-span-2">
                      <label className={labelClass}>Nombre de la plantilla</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        placeholder="Ej: Contrato Término Indefinido — Mesero"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Tipo de contrato</label>
                      <SelectInput
                        value={form.contractType}
                        onChange={(v) => setForm((prev) => ({ ...prev, contractType: v as ContractType }))}
                        options={CONTRACT_TYPE_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Cargo / Posición</label>
                      <input
                        value={form.position}
                        onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
                        required
                        placeholder="Ej: Mesero, Chef, General"
                        className={inputClass}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClass}>Descripción</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        placeholder="Descripción breve de la plantilla..."
                        className={`${inputClass} resize-y`}
                      />
                    </div>
                  </div>

                  {/* Clauses */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-body font-semibold text-dark-graphite">
                        Cláusulas ({clauses.length})
                      </h3>
                      <button
                        type="button"
                        onClick={addClause}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-input-border text-caption font-medium text-graphite hover:bg-bone transition-colors"
                      >
                        <Plus size={13} strokeWidth={2} />
                        Agregar cláusula
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {clauses.map((clause, idx) => (
                        <ClauseEditor
                          key={clause.id}
                          clause={clause}
                          onChange={(updated) => handleClauseChange(idx, updated)}
                          onMoveUp={() => handleMoveUp(idx)}
                          onMoveDown={() => handleMoveDown(idx)}
                          onDelete={() => handleDeleteClause(idx)}
                          isFirst={idx === 0}
                          isLast={idx === clauses.length - 1}
                        />
                      ))}
                    </div>

                    {clauses.length === 0 && (
                      <div className="text-center py-8 text-caption text-mid-gray">
                        No hay cláusulas. Carga una plantilla base o agrega cláusulas manualmente.
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-border shrink-0">
                  {isEditing && !template?.isDefault && (
                    <HoverHint label="Eliminar plantilla">
                      <button
                        type="button"
                        onClick={() => setDeleteOpen(true)}
                        className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                      >
                        <Trash2 size={15} strokeWidth={1.5} />
                      </button>
                    </HoverHint>
                  )}
                  <div className="flex items-center gap-3 ml-auto">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saveMutation.isPending || clauses.length === 0}
                      className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saveMutation.isPending ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Plantilla'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar Plantilla"
        description={`¿Estás seguro de que deseas eliminar "${form.name || 'esta plantilla'}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  )
}
