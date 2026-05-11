import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/core/hooks/use-auth'
import { tasksService } from '../services'
import type { Task, TaskInput } from '../types'

const KEY = (uid: string | undefined) => ['user-tasks', uid] as const

export function useTasks() {
  const { user } = useAuth()
  const uid = user?.uid
  return useQuery<Task[]>({
    queryKey: KEY(uid),
    queryFn: () => tasksService.getAll(uid!),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTaskMutations() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY(uid) })

  const create = useMutation({
    mutationFn: (data: TaskInput) => tasksService.create(uid, data),
    onSettled: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskInput> }) =>
      tasksService.update(uid, id, data),
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => tasksService.remove(uid, id),
    onSettled: invalidate,
  })

  const reorder = useMutation({
    mutationFn: (changes: { id: string; order: number }[]) =>
      Promise.all(changes.map((c) => tasksService.update(uid, c.id, { order: c.order }))),
    onMutate: async (changes) => {
      await qc.cancelQueries({ queryKey: KEY(uid) })
      const prev = qc.getQueryData<Task[]>(KEY(uid))
      const orderById = new Map(changes.map((c) => [c.id, c.order]))
      qc.setQueryData<Task[]>(KEY(uid), (old) =>
        old?.map((t) => (orderById.has(t.id) ? { ...t, order: orderById.get(t.id)! } : t)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY(uid), ctx.prev)
    },
    onSettled: invalidate,
  })

  return { create, update, remove, reorder }
}
