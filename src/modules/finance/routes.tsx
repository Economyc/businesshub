import { lazy } from 'react'

export const TransactionList = lazy(() => import('./components/transaction-list').then(m => ({ default: m.TransactionList })))
export const TransactionForm = lazy(() => import('./components/transaction-form').then(m => ({ default: m.TransactionForm })))
export const ImportView = lazy(() => import('./components/import-view').then(m => ({ default: m.ImportView })))
export const CashFlowView = lazy(() => import('./components/cash-flow-view').then(m => ({ default: m.CashFlowView })))
export const IncomeStatementView = lazy(() => import('./components/income-statement-view').then(m => ({ default: m.IncomeStatementView })))
export const BudgetView = lazy(() => import('./components/budget-view').then(m => ({ default: m.BudgetView })))
export const RecurringList = lazy(() => import('./components/recurring-list').then(m => ({ default: m.RecurringList })))
