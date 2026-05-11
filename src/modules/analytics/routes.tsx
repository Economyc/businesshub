import { lazy } from 'react'

export const PosDashboard = lazy(() => import('./components/pos-dashboard').then(m => ({ default: m.PosDashboard })))
