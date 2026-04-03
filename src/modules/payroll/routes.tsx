import { lazy } from 'react'

export const PayrollList = lazy(() => import('./components/payroll-list').then(m => ({ default: m.PayrollList })))
export const PayrollDetail = lazy(() => import('./components/payroll-detail').then(m => ({ default: m.PayrollDetail })))
