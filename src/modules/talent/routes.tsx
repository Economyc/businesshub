import { lazy } from 'react'

export const EmployeeList = lazy(() => import('./components/employee-list').then(m => ({ default: m.EmployeeList })))
export const EmployeeForm = lazy(() => import('./components/employee-form').then(m => ({ default: m.EmployeeForm })))
export const EmployeeProfile = lazy(() => import('./components/employee-profile').then(m => ({ default: m.EmployeeProfile })))
