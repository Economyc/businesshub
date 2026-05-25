import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { queryClient } from '@/core/query/query-client'
import { paymentMethodService } from './services'
import type { PaymentMethod } from './types'

// Lista de métodos de pago de la company activa + mutaciones de catálogo.
// El catálogo es un array de objetos; add/update/remove operan por id y
// reescriben el array completo, sincronizando el cache de React Query con
// setQueryData para feedback inmediato.
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

  async function persist(next: PaymentMethod[]) {
    if (!companyId) return
    queryClient.setQueryData(queryKey, next)
    await paymentMethodService.setList(companyId, next)
  }

  function addMethod(input: Omit<PaymentMethod, 'id'>) {
    const id = crypto.randomUUID()
    void persist([...methods, { ...input, id }])
  }

  // Reemplaza los campos editables (no hace merge) para que limpiar entidad o
  // últimos 4 en el formulario realmente los borre y no queden valores undefined.
  function updateMethod(id: string, data: Omit<PaymentMethod, 'id'>) {
    void persist(methods.map((m) => (m.id === id ? { ...data, id } : m)))
  }

  function removeMethod(id: string) {
    void persist(methods.filter((m) => m.id !== id))
  }

  return { methods, loading: isLoading, addMethod, updateMethod, removeMethod }
}
