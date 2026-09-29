import { lazy } from 'react'

export const ReportsPage = lazy(() => import('./components/reports-page').then(m => ({ default: m.ReportsPage })))
export const DeliveryReportsPage = lazy(() => import('./components/delivery-reports-page').then(m => ({ default: m.DeliveryReportsPage })))
export const ClosingPage = lazy(() => import('./closing/closing-page').then(m => ({ default: m.ClosingPage })))
export const ReportDetailPage = lazy(() => import('./components/report-detail-page').then(m => ({ default: m.ReportDetailPage })))
export const LegacyReportRedirect = lazy(() => import('./components/report-detail-page').then(m => ({ default: m.LegacyReportRedirect })))
