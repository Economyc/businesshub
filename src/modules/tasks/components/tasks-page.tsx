import { useMemo, useState } from 'react'
import { Plus, ListTodo } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Skeleton } from '@/core/ui/skeleton'
import { PageHeader } from '@/core/ui/page-header'
import { useTasks, useTaskMutations } from '../hooks/use-tasks'
import type { Task } from '../types'
import { TaskForm } from './task-form'
import { SortableTaskCard } from './sortable-task-card'

const byOrder = (a: Task, b: Task) => (a.order ?? Infinity) - (b.order ?? Infinity)

export function TasksPage() {
  const { data: tasks, isLoading } = useTasks()
  const { update, reorder } = useTaskMutations()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const { todo, done } = useMemo(() => {
    const list = tasks ?? []
    return {
      todo: list.filter((t) => t.status === 'todo').sort(byOrder),
      done: list.filter((t) => t.status === 'done').sort(byOrder),
    }
  }, [tasks])

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(task: Task) {
    setEditing(task)
    setFormOpen(true)
  }

  function toggleStatus(task: Task) {
    update.mutate({
      id: task.id,
      data: { status: task.status === 'todo' ? 'done' : 'todo' },
    })
  }

  function handleDragEnd(column: Task[]) {
    return (e: DragEndEvent) => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIndex = column.findIndex((t) => t.id === active.id)
      const newIndex = column.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      const reordered = arrayMove(column, oldIndex, newIndex)
      const changes = reordered
        .map((t, i) => ({ id: t.id, order: i, prevOrder: t.order }))
        .filter((c) => c.prevOrder !== c.order)
        .map(({ id, order }) => ({ id, order }))
      if (changes.length) reorder.mutate(changes)
    }
  }

  function renderColumn(column: Task[], emptyText: string, showCreateButton: boolean) {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )
    }
    if (column.length === 0) {
      return (
        <div className="card-elevated rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-10 w-10 rounded-full bg-bone flex items-center justify-center text-mid-gray">
            <ListTodo size={20} strokeWidth={1.5} />
          </div>
          <p className="text-body text-mid-gray">{emptyText}</p>
          {showCreateButton && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input-border text-body text-graphite hover:bg-bone transition-colors"
            >
              <Plus size={14} strokeWidth={1.5} />
              Nueva tarea
            </button>
          )}
        </div>
      )
    }
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(column)}>
        <SortableContext items={column.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {column.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onToggleStatus={toggleStatus}
                onClick={openEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Tasks" subtitle={<span className="text-body text-mid-gray">Pendientes personales · cross-company</span>}>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-graphite text-white text-body font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} strokeWidth={1.5} />
          Nueva tarea
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Columna To Do */}
        <section className="flex flex-col gap-3">
          <header className="flex items-center gap-2">
            <h2 className="text-subheading text-graphite">To do</h2>
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-graphite text-white text-[10px] font-semibold">
              {todo.length}
            </span>
          </header>
          {renderColumn(todo, 'Sin tareas pendientes. Crea tu primera tarea.', true)}
        </section>

        {/* Columna Done */}
        <section className="flex flex-col gap-3">
          <header className="flex items-center gap-2">
            <h2 className="text-subheading text-graphite">Done</h2>
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-bone text-mid-gray text-[10px] font-semibold">
              {done.length}
            </span>
          </header>
          {renderColumn(done, 'Aún no has completado ninguna tarea.', false)}
        </section>
      </div>

      <TaskForm open={formOpen} task={editing} onClose={() => setFormOpen(false)} />
    </div>
  )
}
