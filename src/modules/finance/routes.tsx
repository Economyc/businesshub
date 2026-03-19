import { lazy } from 'react'

export const TransactionList = lazy(() => import('./components/transaction-list').then(m => ({ default: m.TransactionList })))
export const TransactionForm = lazy(() => import('./components/transaction-form').then(m => ({ default: m.TransactionForm })))
export const ImportView = lazy(() => import('./components/import-view').then(m => ({ default: m.ImportView })))
