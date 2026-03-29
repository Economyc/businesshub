import { lazy } from 'react'

export const ClosingList = lazy(() => import('./components/closing-list').then(m => ({ default: m.ClosingList })))
