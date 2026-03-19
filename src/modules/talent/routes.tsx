import { lazy } from 'react'

export const EmployeeList = lazy(() => import('./components/employee-list').then(m => ({ default: m.EmployeeList })))
