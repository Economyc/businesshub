import { lazy } from 'react'

export const ReportsPage = lazy(() => import('./components/reports-page').then(m => ({ default: m.ReportsPage })))
export const ReportDetailPage = lazy(() => import('./components/report-detail-page').then(m => ({ default: m.ReportDetailPage })))
