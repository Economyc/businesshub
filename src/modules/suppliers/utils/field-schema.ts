import { Timestamp } from 'firebase/firestore'
import type { FieldDef } from '@/core/utils/data-transfer'

function formatTimestamp(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'object' && 'toDate' in (val as Timestamp)) {
    return (val as Timestamp).toDate().toISOString().slice(0, 10)
  }
  return String(val)
}

function parseDate(raw: string): Timestamp {
  const d = new Date(raw)
  if (isNaN(d.getTime())) throw new Error('Fecha invalida')
  return Timestamp.fromDate(d)
}

export const supplierFields: FieldDef[] = [
  { key: 'name', header: 'Nombre', required: true, type: 'string' },
  { key: 'identification', header: 'Identificacion', type: 'string' },
  { key: 'category', header: 'Categoria', required: true, type: 'string' },
  { key: 'contactName', header: 'Contacto', required: true, type: 'string' },
  { key: 'email', header: 'Email', required: true, type: 'string' },
  { key: 'phone', header: 'Telefono', type: 'string' },
  {
    key: 'status',
    header: 'Estado',
    required: true,
    type: 'enum',
    enumValues: ['active', 'expired', 'pending'],
  },
  {
    key: 'contractStart',
    header: 'Inicio Contrato',
    type: 'date',
    format: formatTimestamp,
    parse: parseDate,
  },
  {
    key: 'contractEnd',
    header: 'Fin Contrato',
    type: 'date',
    format: formatTimestamp,
    parse: parseDate,
  },
  { key: 'paymentTerms', header: 'Plazo Pago (dias)', type: 'number' },
  { key: 'creditLimit', header: 'Cupo Credito', type: 'number' },
]
