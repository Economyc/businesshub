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

export const employeeFields: FieldDef[] = [
  { key: 'name', header: 'Nombre', required: true, type: 'string' },
  { key: 'identification', header: 'Identificacion', required: true, type: 'string' },
  { key: 'role', header: 'Cargo', required: true, type: 'string' },
  { key: 'department', header: 'Departamento', required: true, type: 'string' },
  { key: 'email', header: 'Email', required: true, type: 'string' },
  { key: 'phone', header: 'Telefono', type: 'string' },
  {
    key: 'salary',
    header: 'Salario',
    required: true,
    type: 'number',
  },
  {
    key: 'startDate',
    header: 'Fecha Ingreso',
    required: true,
    type: 'date',
    format: formatTimestamp,
    parse: parseDate,
  },
  {
    key: 'status',
    header: 'Estado',
    required: true,
    type: 'enum',
    enumValues: ['active', 'inactive'],
  },
]
