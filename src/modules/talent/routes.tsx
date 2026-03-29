import { lazy } from 'react'

export const EmployeeList = lazy(() => import('./components/employee-list').then(m => ({ default: m.EmployeeList })))
export const EmployeeProfile = lazy(() => import('./components/employee-profile').then(m => ({ default: m.EmployeeProfile })))
