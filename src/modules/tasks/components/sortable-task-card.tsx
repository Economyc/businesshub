import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { Task } from '../types'
import { TaskCard } from './task-card'

interface SortableTaskCardProps {
  task: Task
  onToggleStatus: (task: Task) => void
  onClick: (task: Task) => void
}

export function SortableTaskCard({ task, onToggleStatus, onClick }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none',
      }}
      className={cn('outline-none', isDragging && 'opacity-50')}
    >
      <TaskCard task={task} onToggleStatus={onToggleStatus} onClick={onClick} />
    </div>
  )
}
