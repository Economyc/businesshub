import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy } from 'firebase/firestore'
import type { Employee } from './types'

export function useEmployees() {
  return useCollection<Employee>('employees')
}

export function usePaginatedEmployees() {
  return usePaginatedCollection<Employee>('employees', 50, orderBy('createdAt', 'desc'))
}

export function useEmployee(id: string | undefined) {
  return useDocument<Employee>('employees', id)
}
