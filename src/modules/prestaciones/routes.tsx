import { lazy } from 'react'

export const SettlementList = lazy(() => import('./components/settlement-list').then(m => ({ default: m.SettlementList })))
export const SettlementDetail = lazy(() => import('./components/settlement-detail').then(m => ({ default: m.SettlementDetail })))
