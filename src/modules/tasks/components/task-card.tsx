import { useMemo } from 'react'
import { CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Task, TaskPriority } from '../types'

interface TaskCardProps {
  task: Task
  onToggleStatus: (task: Task) => void
  onClick: (task: Task) => void
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

const PRIORITY_VARIANT: Record<TaskPriority, 'negative' | 'warning' | 'info' | null> = {
  urgent: 'negative',
  high: 'warning',
  medium: 'info',
  low: null,
}

export function TaskCard({ task, onToggleStatus, onClick }: TaskCardProps) {
  const done = task.status === 'done'
  const priorityVariant = PRIORITY_VARIANT[task.priority]
  const subtaskStats = useMemo(() => {
    const total = task.subtasks.length
    const completed = task.subtasks.filter((s) => s.done).length
    return { total, completed }
  }, [task.subtasks])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(task)
        }
      }}
      className="card-elevated rounded-xl p-4 cursor-pointer hover:border-border transition-colors duration-150 flex flex-col gap-3 text-left"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={done ? 'Marcar como pendiente' : 'Marcar como completada'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleStatus(task)
          }}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
            done
              ? 'bg-graphite border-graphite text-white'
              : 'border-border hover:border-graphite/60 bg-card-bg'
          )}
        >
          {done && <CheckSquare size={12} strokeWidth={2} />}
        </button>
        <h3
          className={cn(
            'text-subheading font-medium leading-snug flex-1',
            done ? 'text-mid-gray line-through' : 'text-dark-graphite'
          )}
        >
          {task.title}
        </h3>
      </div>

      {(task.companyTag || priorityVariant) && (
        <div className="flex flex-wrap items-center gap-2">
          {task.companyTag && (
            <Badge
              variant="default"
              style={
                task.companyTag.color
                  ? { backgroundColor: `${task.companyTag.color}1A`, color: task.companyTag.color }
                  : undefined
              }
            >
              {task.companyTag.name}
            </Badge>
          )}
          {priorityVariant && (
            <Badge variant={priorityVariant}>{PRIORITY_LABEL[task.priority]}</Badge>
          )}
        </div>
      )}

      {subtaskStats.total > 0 && (
        <div className="flex items-center gap-1.5 text-caption text-mid-gray">
          <CheckSquare size={13} strokeWidth={1.5} />
          <span>
            {subtaskStats.completed}/{subtaskStats.total} subtareas
          </span>
        </div>
      )}
    </div>
  )
}
