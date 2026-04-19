import { lazy } from 'react'

export const GeneralDashboard = lazy(() => import('./components/general-dashboard').then(m => ({ default: m.GeneralDashboard })))
export const PosDashboard = lazy(() => import('./components/pos-dashboard').then(m => ({ default: m.PosDashboard })))
export const CostsDashboard = lazy(() => import('./components/costs-dashboard').then(m => ({ default: m.CostsDashboard })))
export const PurchasesDashboard = lazy(() => import('./components/purchases-dashboard').then(m => ({ default: m.PurchasesDashboard })))
export const PayrollDashboard = lazy(() => import('./components/payroll-dashboard').then(m => ({ default: m.PayrollDashboard })))
