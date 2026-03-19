import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

export interface Employee extends BaseEntity {
  name: string
  role: string
  department: string
  email: string
  phone: string
  salary: number
  startDate: Timestamp
  status: 'active' | 'inactive'
}

export type EmployeeFormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>
