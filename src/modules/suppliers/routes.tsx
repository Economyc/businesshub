import { lazy } from 'react'

export const SupplierList = lazy(() => import('./components/supplier-list').then(m => ({ default: m.SupplierList })))
