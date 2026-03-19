import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import type { Employee } from './types'

export function useEmployees() {
  return useCollection<Employee>('employees')
}

export function useEmployee(id: string | undefined) {
  return useDocument<Employee>('employees', id)
}
