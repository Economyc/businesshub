import { lazy } from 'react'

export const HomePage = lazy(() => import('./components/home-page').then(m => ({ default: m.HomePage })))
