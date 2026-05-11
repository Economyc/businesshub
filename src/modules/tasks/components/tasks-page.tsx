import { useMemo, useState } from 'react'
import { Plus, ListTodo } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/core/ui/skeleton'
import { PageHeader } from '@/core/ui/page-header'
import { useTasks, useTaskMutations } from '../hooks/use-tasks'
import type { Task, TaskStatus } from '../types'
import { TaskCard } from './task-card'
import { TaskForm } from './task-form'

export function TasksPage() {
  const { data: tasks, isLoading } = useTasks()
  const { update } = useTaskMutations()
  const [tab, setTab] = useState<TaskStatus>('todo')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  const { todo, done } = useMemo(() => {
    const list = tasks ?? []
    return {
      todo: list.filter((t) => t.status === 'todo'),
      done: list.filter((t) => t.status === 'done'),
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

  const visible = tab === 'todo' ? todo : done

  return (
    <div className="p-6 max-w-6xl mx-auto">
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

      <Tabs value={tab} onValueChange={(v: unknown) => setTab(v as TaskStatus)} className="gap-6">
        <TabsList>
          <TabsTrigger value="todo">
            To do
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-graphite text-white text-[10px] font-semibold">
              {todo.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="done">
            Done
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-bone text-mid-gray text-[10px] font-semibold">
              {done.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="card-elevated rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3">
              <div className="h-10 w-10 rounded-full bg-bone flex items-center justify-center text-mid-gray">
                <ListTodo size={20} strokeWidth={1.5} />
              </div>
              <p className="text-body text-mid-gray">
                {tab === 'todo'
                  ? 'Sin tareas pendientes. Crea tu primera tarea.'
                  : 'Aún no has completado ninguna tarea.'}
              </p>
              {tab === 'todo' && (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleStatus={toggleStatus}
                  onClick={openEdit}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TaskForm open={formOpen} task={editing} onClose={() => setFormOpen(false)} />
    </div>
  )
}
