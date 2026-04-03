import { tool } from 'ai'
import { z } from 'zod'
import { fetchCollection, fetchDocument } from '../firestore.js'

function serializeTimestamp(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'object' && val !== null && '_seconds' in val) {
    const ts = val as { _seconds: number }
    return new Date(ts._seconds * 1000).toISOString().split('T')[0]
  }
  return String(val)
}

function formatEmployee(emp: Record<string, unknown>) {
  return {
    id: emp.id,
    name: emp.name,
    identification: emp.identification,
    role: emp.role,
    department: emp.department,
    email: emp.email,
    phone: emp.phone,
    salary: emp.salary,
    startDate: serializeTimestamp(emp.startDate),
    status: emp.status,
  }
}

export function createEmployeeTools(companyId: string) {
  return {
    getEmployees: tool({
      description: 'Obtiene la lista de empleados. Puede filtrar por departamento y/o estado.',
      parameters: z.object({
        department: z.string().optional().describe('Filtrar por departamento'),
        status: z.enum(['active', 'inactive']).optional().describe('Filtrar por estado: active o inactive'),
      }),
      execute: async ({ department, status }) => {
        const employees = await fetchCollection(companyId, 'employees')
        let filtered = employees
        if (department) {
          filtered = filtered.filter(
            (e) => String(e.department).toLowerCase() === department.toLowerCase()
          )
        }
        if (status) {
          filtered = filtered.filter((e) => e.status === status)
        }
        return {
          count: filtered.length,
          employees: filtered.map(formatEmployee),
        }
      },
    }),

    getEmployee: tool({
      description: 'Obtiene el detalle de un empleado por su ID.',
      parameters: z.object({
        id: z.string().describe('ID del empleado'),
      }),
      execute: async ({ id }) => {
        const emp = await fetchDocument(companyId, 'employees', id)
        if (!emp) return { error: 'Empleado no encontrado' }
        return formatEmployee(emp)
      },
    }),
  }
}
