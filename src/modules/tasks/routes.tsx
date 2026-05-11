import { lazy } from 'react'

export const TasksPage = lazy(() =>
  import('./components/tasks-page').then((m) => ({ default: m.TasksPage }))
)
