import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { listStatements, getBankMovements } from './bank-service'

const STALE_MS = 5 * 60 * 1000

export function useBankStatements() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bank-statements', companyId],
    queryFn: () => listStatements(companyId!),
    enabled: !!companyId,
    staleTime: STALE_MS,
  })

  return { data: data ?? [], loading: isLoading, error: error as Error | null, refetch }
}

export function useBankMovements(statementId?: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bank-movements', companyId, statementId ?? 'all'],
    queryFn: () => getBankMovements(companyId!, statementId),
    enabled: !!companyId,
    staleTime: STALE_MS,
  })

  return { data: data ?? [], loading: isLoading, error: error as Error | null, refetch }
}
