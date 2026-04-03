import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

export interface Employee extends BaseEntity {
  name: string
  identification: string
  role: string
  department: string
  email: string
  phone: string
  salary: number
  startDate: Timestamp
  status: 'active' | 'inactive'
}

export type EmployeeFormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>

export type DocumentCategory = 'cedula' | 'rut' | 'certificado' | 'examen_medico' | 'carta' | 'contrato' | 'otro'

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  cedula: 'Cédula',
  rut: 'RUT',
  certificado: 'Certificado',
  examen_medico: 'Examen Médico',
  carta: 'Carta',
  contrato: 'Contrato',
  otro: 'Otro',
}

export interface EmployeeDocument extends BaseEntity {
  name: string
  category: DocumentCategory
  url: string
  storagePath: string
  size: number
  contentType: string
}
