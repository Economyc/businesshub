import { tool } from 'ai'
import { z } from 'zod'

/**
 * Mutation tools do NOT have an `execute` function.
 * The Vercel AI SDK will return these as tool calls to the client,
 * where the user must confirm before the action is executed.
 */
export function createMutationTools() {
  return {
    createEmployee: tool({
      description: 'Crea un nuevo empleado. Requiere confirmación del usuario antes de ejecutarse.',
      parameters: z.object({
        name: z.string().describe('Nombre completo del empleado'),
        identification: z.string().describe('Número de identificación (cédula)'),
        role: z.string().describe('Cargo del empleado'),
        department: z.string().describe('Departamento'),
        email: z.string().email().describe('Correo electrónico'),
        phone: z.string().describe('Teléfono'),
        salary: z.number().describe('Salario mensual'),
        startDate: z.string().describe('Fecha de inicio en formato YYYY-MM-DD'),
        status: z.enum(['active', 'inactive']).optional().default('active'),
      }),
      // No execute — handled client-side with confirmation
    }),

    updateEmployee: tool({
      description: 'Actualiza datos de un empleado existente. Requiere confirmación del usuario.',
      parameters: z.object({
        id: z.string().describe('ID del empleado a actualizar'),
        name: z.string().optional().describe('Nuevo nombre'),
        role: z.string().optional().describe('Nuevo cargo'),
        department: z.string().optional().describe('Nuevo departamento'),
        email: z.string().email().optional().describe('Nuevo correo electrónico'),
        phone: z.string().optional().describe('Nuevo teléfono'),
        salary: z.number().optional().describe('Nuevo salario mensual'),
        status: z.enum(['active', 'inactive']).optional().describe('Nuevo estado'),
      }),
    }),

    deleteEmployee: tool({
      description: 'Elimina un empleado. Requiere confirmación del usuario. Acción irreversible.',
      parameters: z.object({
        id: z.string().describe('ID del empleado a eliminar'),
        name: z.string().describe('Nombre del empleado (para confirmación)'),
      }),
    }),

    createSupplier: tool({
      description: 'Crea un nuevo proveedor. Requiere confirmación del usuario.',
      parameters: z.object({
        name: z.string().describe('Nombre del proveedor o empresa'),
        identification: z.string().describe('NIT o RUT del proveedor'),
        category: z.string().describe('Categoría del proveedor'),
        contactName: z.string().describe('Nombre del contacto'),
        email: z.string().email().describe('Correo electrónico'),
        phone: z.string().describe('Teléfono'),
        contractStart: z.string().describe('Fecha inicio de contrato (YYYY-MM-DD)'),
        contractEnd: z.string().describe('Fecha fin de contrato (YYYY-MM-DD)'),
        status: z.enum(['active', 'expired', 'pending']).optional().default('active'),
      }),
    }),

    updateSupplier: tool({
      description: 'Actualiza datos de un proveedor existente. Requiere confirmación del usuario.',
      parameters: z.object({
        id: z.string().describe('ID del proveedor a actualizar'),
        name: z.string().optional().describe('Nuevo nombre'),
        category: z.string().optional().describe('Nueva categoría'),
        contactName: z.string().optional().describe('Nuevo contacto'),
        email: z.string().email().optional().describe('Nuevo correo'),
        phone: z.string().optional().describe('Nuevo teléfono'),
        status: z.enum(['active', 'expired', 'pending']).optional().describe('Nuevo estado'),
      }),
    }),

    deleteSupplier: tool({
      description: 'Elimina un proveedor. Requiere confirmación del usuario. Acción irreversible.',
      parameters: z.object({
        id: z.string().describe('ID del proveedor a eliminar'),
        name: z.string().describe('Nombre del proveedor (para confirmación)'),
      }),
    }),

    createTransaction: tool({
      description: 'Crea una nueva transacción financiera (ingreso o gasto). Requiere confirmación del usuario.',
      parameters: z.object({
        concept: z.string().describe('Concepto o descripción de la transacción'),
        category: z.string().describe('Categoría de la transacción'),
        amount: z.number().describe('Monto de la transacción'),
        type: z.enum(['income', 'expense']).describe('Tipo: income (ingreso) o expense (gasto)'),
        date: z.string().describe('Fecha de la transacción (YYYY-MM-DD)'),
        status: z.enum(['paid', 'pending']).optional().default('paid').describe('Estado: paid o pending'),
        notes: z.string().optional().describe('Notas adicionales'),
      }),
    }),

    updateTransaction: tool({
      description: 'Actualiza una transacción financiera existente. Requiere confirmación del usuario.',
      parameters: z.object({
        id: z.string().describe('ID de la transacción a actualizar'),
        concept: z.string().optional().describe('Nuevo concepto'),
        category: z.string().optional().describe('Nueva categoría'),
        amount: z.number().optional().describe('Nuevo monto'),
        type: z.enum(['income', 'expense']).optional().describe('Nuevo tipo'),
        date: z.string().optional().describe('Nueva fecha (YYYY-MM-DD)'),
        status: z.enum(['paid', 'pending']).optional().describe('Nuevo estado'),
        notes: z.string().optional().describe('Nuevas notas'),
      }),
    }),

    deleteTransaction: tool({
      description: 'Elimina una transacción financiera. Requiere confirmación del usuario. Acción irreversible.',
      parameters: z.object({
        id: z.string().describe('ID de la transacción a eliminar'),
        concept: z.string().describe('Concepto de la transacción (para confirmación)'),
      }),
    }),
  }
}
