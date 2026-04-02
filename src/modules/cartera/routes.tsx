import { lazy } from 'react'

export const CarteraDashboard = lazy(() => import('./components/cartera-dashboard').then(m => ({ default: m.CarteraDashboard })))
