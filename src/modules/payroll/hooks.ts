import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { useCompany } from '@/core/hooks/use-company'
import { useQuery } from '@tanstack/react-query'
import { payrollService } from './services'
import type { PayrollRecord, PayrollFormData } from './types'

export function usePayrolls() {
  return useCollection<PayrollRecord>('payrolls')
}

export function usePayroll(id: string | undefined) {
  return useDocument<PayrollRecord>('payrolls', id)
}

export function usePayrollByEmployee(employeeId: string | undefined) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll-employee', companyId, employeeId],
    queryFn: () => payrollService.getByEmployee(companyId!, employeeId!),
    enabled: !!companyId && !!employeeId,
  })

  return {
    data: (data ?? []) as PayrollRecord[],
    loading: isLoading,
    error: error as Error | null,
  }
}

export function usePayrollMutation() {
  return useFirestoreMutation<{ id?: string } & Partial<PayrollFormData>>(
    'payrolls',
    async (companyId, data) => {
      const { id, ...rest } = data
      if (id) await payrollService.update(companyId, id, rest)
      else await payrollService.create(companyId, rest as PayrollFormData)
    },
    { invalidate: ['transactions'] },
  )
}

export function usePayrollDelete() {
  return useFirestoreMutation<string>(
    'payrolls',
    (companyId, id) => payrollService.remove(companyId, id),
    { optimisticDelete: true },
  )
}
