import { lazy } from 'react'

export const ScheduleView = lazy(() =>
  import('./components/schedule-view').then((m) => ({ default: m.ScheduleView })),
)
