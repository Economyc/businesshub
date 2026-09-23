import { lazy } from 'react'

export const AttendancePage = lazy(() =>
  import('./components/attendance-page').then((m) => ({ default: m.AttendancePage })),
)

export const KioskPage = lazy(() =>
  import('./components/kiosk-page').then((m) => ({ default: m.KioskPage })),
)
