import { lazy } from 'react'

export const KPIDashboard = lazy(() => import('./components/kpi-dashboard').then(m => ({ default: m.KPIDashboard })))
