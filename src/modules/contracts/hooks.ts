import { useCollection, useDocument } from '@/core/hooks/use-firestore'
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
