import { lazy } from 'react'

export const TransactionList = lazy(() => import('./components/transaction-list').then(m => ({ default: m.TransactionList })))
