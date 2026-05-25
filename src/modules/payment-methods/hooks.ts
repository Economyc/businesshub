import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { queryClient } from '@/core/query/query-client'
import { paymentMethodService } from './services'

// Lista de métodos de pago de la company activa + mutaciones de catálogo.
// El catálogo es un array de strings; add/remove/update lo reescriben completo
// (mismo enfoque que addDepartment/updateDepartment en company-provider) y
// sincronizan el cache de React Query con setQueryData para feedback inmediato.
export function usePaymentMethods() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const queryKey = ['firestore', companyId, 'settings', 'paymentMethods'] as const

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => paymentMethodService.getList(companyId!),
    enabled: !!companyId,
  })

  const methods = data ?? []

  async function persist(next: string[]) {
    if (!companyId) return
    queryClient.setQueryData(queryKey, next)
    await paymentMethodService.setList(companyId, next)
  }

  function addMethod(name: string) {
    const trimmed = name.trim()
    if (!trimmed || methods.includes(trimmed)) return
    void persist([...methods, trimmed])
  }

  function removeMethod(name: string) {
    void persist(methods.filter((m) => m !== name))
  }

  function updateMethod(oldName: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName || methods.includes(trimmed)) return
    void persist(methods.map((m) => (m === oldName ? trimmed : m)))
  }

  return { methods, loading: isLoading, addMethod, removeMethod, updateMethod }
}
