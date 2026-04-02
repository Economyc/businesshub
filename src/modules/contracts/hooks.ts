import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import { usePaginatedCollection } from '@/core/hooks/use-paginated-collection'
import { orderBy } from 'firebase/firestore'
import type { ContractTemplate, Contract } from './types'

export function useTemplates() {
  return useCollection<ContractTemplate>('contract_templates')
}

export function useTemplate(id: string | undefined) {
  return useDocument<ContractTemplate>('contract_templates', id)
}

export function useContracts() {
  return useCollection<Contract>('contracts')
}

export function useContract(id: string | undefined) {
  return useDocument<Contract>('contracts', id)
}

export function usePaginatedContracts() {
  return usePaginatedCollection<Contract>('contracts', 50, orderBy('createdAt', 'desc'))
}
