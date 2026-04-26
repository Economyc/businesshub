import { useQuery } from '@tanstack/react-query'
import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { useCompany } from '@/core/hooks/use-company'
import { orderBy, where } from 'firebase/firestore'
import { fetchCollection } from '@/core/firebase/helpers'
import { talentService } from './services'
import type { Employee, EmployeeDocument } from './types'

export function useEmployees() {
  return useCollection<Employee>('employees')
}

// Solo empleados activos. Para selectores en formularios (nómina, contratos,
// liquidaciones) que no deben mostrar gente que ya no trabaja en la empresa.
// Filtra server-side, así que el dropdown no descarga inactivos.
export function useActiveEmployees() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'employees', 'active'],
    queryFn: () =>
      fetchCollection<Employee>(
        companyId!,
        'employees',
        where('status', '==', 'active'),
      ),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    data: data ?? [],
    loading: isLoading,
    error: error as Error | null,
    refetch,
  }
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
