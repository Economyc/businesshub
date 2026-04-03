import { useQuery } from '@tanstack/react-query'
import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { useCompany } from '@/core/hooks/use-company'
import { orderBy } from 'firebase/firestore'
import { talentService } from './services'
import type { Employee, EmployeeDocument } from './types'

export function useEmployees() {
  return useCollection<Employee>('employees')
}

export function usePaginatedEmployees() {
  return usePaginatedCollection<Employee>('employees', 50, orderBy('createdAt', 'desc'))
}

export function useEmployee(id: string | undefined) {
  return useDocument<Employee>('employees', id)
}

export function useEmployeeDocuments(employeeId: string | undefined) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employee-documents', companyId, employeeId],
    queryFn: () => talentService.getDocuments(companyId!, employeeId!),
    enabled: !!companyId && !!employeeId,
  })

  return {
    data: (data ?? []) as EmployeeDocument[],
    loading: isLoading,
    error: error as Error | null,
    refetch,
  }
}
