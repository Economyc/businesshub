import { lazy } from 'react'

export const SupplierList = lazy(() => import('./components/supplier-list').then(m => ({ default: m.SupplierList })))
export const SupplierDetail = lazy(() => import('./components/supplier-detail').then(m => ({ default: m.SupplierDetail })))
