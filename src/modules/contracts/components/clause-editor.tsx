import { useState } from 'react'
import { ChevronUp, ChevronDown, Trash2, Lock } from 'lucide-react'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { HoverHint } from '@/components/ui/tooltip'
import type { ClauseDefinition } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

const categoryLabels: Record<ClauseDefinition['category'], string> = {
  mandatory: 'Obligatoria',
  optional: 'Opcional',
  position_specific: 'Por cargo',
}

const categoryColors: Record<ClauseDefinition['category'], string> = {
  mandatory: 'bg-blue-50 text-blue-700 border-blue-200',
  optional: 'bg-amber-50 text-amber-700 border-amber-200',
  position_specific: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

interface ClauseEditorProps {
  clause: ClauseDefinition
  onChange: (updated: ClauseDefinition) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  isFirst: boolean
  isLast: boolean
}

export function ClauseEditor({
  clause,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  isFirst,
  isLast,
}: ClauseEditorProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="border border-border rounded-xl p-4 bg-surface-elevated">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1 rounded text-mid-gray hover:text-graphite hover:bg-bone disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1 rounded text-mid-gray hover:text-graphite hover:bg-bone disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${categoryColors[clause.category]}`}>
              {categoryLabels[clause.category]}
            </span>
            {clause.isRequired && (
              <span className="inline-flex items-center gap-1 text-[11px] text-mid-gray">
                <Lock size={10} /> Requerida
              </span>
            )}
          </div>
          <div className="mb-2">
            <label className={labelClass}>Título</label>
            <input
              value={clause.title}
              onChange={(e) => onChange({ ...clause, title: e.target.value })}
              disabled={!clause.isEditable}
              className={inputClass}
              placeholder="Título de la cláusula"
            />
          </div>
          <div>
            <label className={labelClass}>Contenido</label>
            <textarea
              value={clause.content}
              onChange={(e) => onChange({ ...clause, content: e.target.value })}
              disabled={!clause.isEditable}
              rows={4}
              className={`${inputClass} resize-y min-h-[80px]`}
              placeholder="Texto de la cláusula. Usa {{placeholder}} para variables."
            />
          </div>
        </div>

        <HoverHint label={clause.isRequired ? 'No se puede eliminar una cláusula obligatoria' : 'Eliminar cláusula'}>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={clause.isRequired}
            className="p-1.5 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </HoverHint>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar cláusula"
        description={`¿Estás seguro de que deseas eliminar "${clause.title || 'esta cláusula'}"? Esta acción no se puede deshacer.`}
        onConfirm={() => { setConfirmOpen(false); onDelete() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
