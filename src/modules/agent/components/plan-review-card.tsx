import { useMemo, useState } from 'react'
import { Check, X, ListChecks, ChevronDown, Pencil, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Wave 5.3 — Card de review humano para planes multi-paso.
//
// Recibe el plan propuesto por la tool `proposeMultiStepPlan`, deja al
// usuario marcar/desmarcar pasos, editar inline el label de cada paso,
// inspeccionar args (colapsable) y aprobar o cancelar. Al aprobar, devuelve
// la lista final de pasos al padre, que los ejecuta secuencialmente.
//
// Sigue DESIGN_SYSTEM: tipografía en escalas, tokens de color, spacing en
// múltiplos de 4, borde 1px (sin shadows), Lucide stroke 1.5.

export interface PlanStep {
  id: string
  label: string
  toolName: string
  toolArgs: Record<string, unknown>
  optional?: boolean
}

export interface PlanProposal {
  title: string
  rationale: string
  steps: PlanStep[]
}

export type ExecutionStatus = 'pending' | 'running' | 'done' | 'error'

export interface StepExecution {
  status: ExecutionStatus
  message?: string
}

interface PlanReviewCardProps {
  plan: PlanProposal
  onApprove: (steps: PlanStep[]) => void
  onCancel: () => void
  // Estado de ejecución por id de paso (opcional; sólo aplica después de aprobar).
  executions?: Record<string, StepExecution>
  isExecuting?: boolean
  isCompleted?: boolean
}

interface EditableStep extends PlanStep {
  included: boolean
}

function buildInitialSteps(steps: PlanStep[]): EditableStep[] {
  return steps.map((s) => ({ ...s, included: !s.optional }))
}

export function PlanReviewCard({
  plan,
  onApprove,
  onCancel,
  executions,
  isExecuting = false,
  isCompleted = false,
}: PlanReviewCardProps) {
  const [steps, setSteps] = useState<EditableStep[]>(() => buildInitialSteps(plan.steps))
  const [openArgs, setOpenArgs] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  const includedCount = useMemo(() => steps.filter((s) => s.included).length, [steps])
  const locked = isExecuting || isCompleted

  function toggleIncluded(id: string) {
    if (locked) return
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, included: !s.included } : s)))
  }

  function updateLabel(id: string, label: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)))
  }

  function toggleArgs(id: string) {
    setOpenArgs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handleApprove() {
    const finalSteps: PlanStep[] = steps
      .filter((s) => s.included)
      .map(({ included: _included, ...rest }) => rest)
    if (finalSteps.length === 0) return
    onApprove(finalSteps)
  }

  return (
    <div className="mx-4 my-2 rounded-xl border border-border/60 bg-card-bg p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-bone text-graphite">
          <ListChecks size={14} strokeWidth={1.5} />
        </div>
        <span className="text-subheading font-medium text-dark-graphite">{plan.title}</span>
        <span className="ml-auto text-caption text-mid-gray">
          {includedCount} de {steps.length} {steps.length === 1 ? 'paso' : 'pasos'}
        </span>
      </div>

      {/* Rationale */}
      {plan.rationale.trim() && (
        <div className="mb-4 pl-3 border-l-2 border-border/60">
          <p className="text-caption text-mid-gray italic">{plan.rationale.trim()}</p>
        </div>
      )}

      {/* Steps */}
      <ol className="space-y-2 mb-4">
        {steps.map((step, idx) => {
          const exec = executions?.[step.id]
          const isOpen = Boolean(openArgs[step.id])
          const isEditing = editingId === step.id
          const argsString = JSON.stringify(step.toolArgs, null, 2)
          return (
            <li
              key={step.id}
              className={cn(
                'rounded-lg border border-border/60 bg-surface p-4',
                !step.included && 'opacity-60',
              )}
            >
              <div className="flex items-start gap-2">
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleIncluded(step.id)}
                  disabled={locked}
                  aria-label={step.included ? 'Excluir paso' : 'Incluir paso'}
                  className={cn(
                    'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                    step.included
                      ? 'bg-graphite border-graphite text-white'
                      : 'bg-card-bg border-border-hover text-transparent',
                    locked && 'cursor-not-allowed',
                  )}
                >
                  {step.included && <Check size={12} strokeWidth={2} />}
                </button>

                {/* Index */}
                <span className="text-caption text-mid-gray font-medium tabular-nums shrink-0 w-6">
                  {String(idx + 1).padStart(2, '0')}
                </span>

                {/* Label + tool chip */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={step.label}
                        onChange={(e) => updateLabel(step.id, e.target.value)}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 min-w-0 text-body text-dark-graphite bg-card-bg border border-border-hover rounded-lg px-2 py-1 outline-none focus:border-graphite"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => !locked && setEditingId(step.id)}
                        disabled={locked}
                        className={cn(
                          'flex-1 min-w-0 text-left text-body text-dark-graphite truncate',
                          !locked && 'hover:underline decoration-dotted underline-offset-4',
                        )}
                      >
                        {step.label || '(sin descripción)'}
                      </button>
                    )}
                    {!isEditing && !locked && (
                      <button
                        type="button"
                        onClick={() => setEditingId(step.id)}
                        className="text-mid-gray hover:text-dark-graphite shrink-0"
                        aria-label="Editar paso"
                      >
                        <Pencil size={12} strokeWidth={1.5} />
                      </button>
                    )}
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-bone text-caption text-mid-gray font-medium">
                      {step.toolName}
                    </span>
                    {step.optional && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-info-bg text-caption text-info-text font-medium">
                        opcional
                      </span>
                    )}
                  </div>

                  {/* Args toggle */}
                  <button
                    type="button"
                    onClick={() => toggleArgs(step.id)}
                    className="mt-2 inline-flex items-center gap-1 text-caption text-mid-gray hover:text-dark-graphite"
                  >
                    <ChevronDown
                      size={12}
                      strokeWidth={1.5}
                      className={cn('transition-transform', isOpen && 'rotate-180')}
                    />
                    {isOpen ? 'Ocultar argumentos' : 'Ver argumentos'}
                  </button>
                  {isOpen && (
                    <pre className="mt-2 rounded-lg bg-bone p-4 text-caption text-graphite overflow-x-auto whitespace-pre">
                      {argsString}
                    </pre>
                  )}

                  {/* Estado de ejecución */}
                  {exec && (
                    <div className="mt-2 flex items-center gap-2 text-caption">
                      {exec.status === 'running' && (
                        <>
                          <Loader2 size={12} strokeWidth={1.5} className="animate-spin text-info-text" />
                          <span className="text-info-text">Ejecutando…</span>
                        </>
                      )}
                      {exec.status === 'done' && (
                        <>
                          <Check size={12} strokeWidth={2} className="text-positive-text" />
                          <span className="text-positive-text">
                            {exec.message ?? 'Completado'}
                          </span>
                        </>
                      )}
                      {exec.status === 'error' && (
                        <>
                          <AlertCircle size={12} strokeWidth={1.5} className="text-negative-text" />
                          <span className="text-negative-text">
                            {exec.message ?? 'Error'}
                          </span>
                        </>
                      )}
                      {exec.status === 'pending' && (
                        <span className="text-mid-gray">En cola</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Acciones */}
      {!locked && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={includedCount === 0}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body font-medium bg-graphite text-white hover:opacity-90 transition-opacity',
              includedCount === 0 && 'opacity-60 cursor-not-allowed',
            )}
          >
            <Check size={14} />
            Aprobar plan
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body font-medium text-mid-gray hover:text-dark-graphite hover:bg-bone transition-colors"
          >
            <X size={14} />
            Cancelar
          </button>
        </div>
      )}
      {isExecuting && !isCompleted && (
        <div className="flex items-center gap-2 text-caption text-mid-gray">
          <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
          Ejecutando plan…
        </div>
      )}
      {isCompleted && (
        <div className="flex items-center gap-2 text-caption text-positive-text">
          <Check size={12} strokeWidth={2} />
          Plan completado
        </div>
      )}
    </div>
  )
}
