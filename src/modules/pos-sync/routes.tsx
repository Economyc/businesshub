import { lazy } from 'react'

export const PosSyncPage = lazy(() => import('./components/pos-sync-page').then(m => ({ default: m.PosSyncPage })))
