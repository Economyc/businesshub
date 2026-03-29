import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity, ContractStatus, ContractType } from '@/core/types'

export interface ClauseDefinition {
  id: string
  title: string
  content: string
  isRequired: boolean
  isEditable: boolean
  order: number
  category: 'mandatory' | 'optional' | 'position_specific'
}

export interface ContractTemplate extends BaseEntity {
  name: string
  contractType: ContractType
  position: string
  description: string
  clauses: ClauseDefinition[]
  isDefault: boolean
}

export type ContractTemplateFormData = Omit<ContractTemplate, 'id' | 'createdAt' | 'updatedAt'>

export interface ContractClause {
  id: string
  title: string
  content: string
  isRequired: boolean
  order: number
}

export interface ContractMetadata {
  companyName: string
  companyNit: string
  companyAddress: string
  companyLegalRep: string
  employeeName: string
  employeeIdentification: string
  employeeAddress: string
  position: string
  salary: number
  salaryWords: string
  paymentFrequency: string
  startDate: string
  endDate?: string
  workSchedule: string
  probationDays?: number
  city: string
  [key: string]: string | number | undefined
}

export interface Contract extends BaseEntity {
  templateId: string
  templateName: string
  contractType: ContractType
  employeeId?: string
  employeeName: string
  employeeIdentification: string
  position: string
  salary: number
  startDate: Timestamp
  endDate?: Timestamp
  status: ContractStatus
  clauses: ContractClause[]
  metadata: ContractMetadata
}

export type ContractFormData = Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>
