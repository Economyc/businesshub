import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { ContractTemplate, ContractTemplateFormData, Contract, ContractFormData } from './types'

const TEMPLATES = 'contract_templates'
const CONTRACTS = 'contracts'

export const templateService = {
  getAll: (companyId: string) => fetchCollection<ContractTemplate>(companyId, TEMPLATES),
  getById: (companyId: string, id: string) => fetchDocument<ContractTemplate>(companyId, TEMPLATES, id),
  create: (companyId: string, data: ContractTemplateFormData) => createDocument(companyId, TEMPLATES, data),
  update: (companyId: string, id: string, data: Partial<ContractTemplateFormData>) => updateDocument(companyId, TEMPLATES, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, TEMPLATES, id),
}

export const contractService = {
  getAll: (companyId: string) => fetchCollection<Contract>(companyId, CONTRACTS),
  getById: (companyId: string, id: string) => fetchDocument<Contract>(companyId, CONTRACTS, id),
  create: (companyId: string, data: ContractFormData) => createDocument(companyId, CONTRACTS, data),
  update: (companyId: string, id: string, data: Partial<ContractFormData>) => updateDocument(companyId, CONTRACTS, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, CONTRACTS, id),
}
