import { tool } from 'ai'
import { z } from 'zod'
import { fetchSettingsDoc } from '../firestore.js'

/**
 * Settings tools — mix de reads (con execute) y mutations (sin execute, ejecutadas
 * en cliente tras confirmación del usuario).
 */
export function createSettingsTools(companyId: string) {
  return {
    getBudget: tool({
      description: 'Obtiene el presupuesto mensual configurado: items por categoría (ingresos y gastos) y totales.',
      parameters: z.object({}),
      execute: async () => {
        const doc = await fetchSettingsDoc(companyId, 'budget')
        const items = (doc?.items as Array<{ category: string; type: string; amount: number }>) ?? []
        const income = items.filter((i) => i.type === 'income')
        const expense = items.filter((i) => i.type === 'expense')
        const totalIncome = income.reduce((s, i) => s + (Number(i.amount) || 0), 0)
        const totalExpense = expense.reduce((s, i) => s + (Number(i.amount) || 0), 0)
        return {
          itemCount: items.length,
          totalBudgetedIncome: totalIncome,
          totalBudgetedExpense: totalExpense,
          netBudgeted: totalIncome - totalExpense,
          income: income.sort((a, b) => b.amount - a.amount),
          expense: expense.sort((a, b) => b.amount - a.amount),
        }
      },
    }),

    updateBudget: tool({
      description: 'Actualiza un item del presupuesto mensual. Requiere confirmación del usuario.',
      parameters: z.object({
        category: z.string().describe('Categoría del presupuesto a modificar'),
        type: z.enum(['income', 'expense']).describe('Tipo: income o expense'),
        amount: z.number().describe('Nuevo monto presupuestado'),
      }),
    }),

    addBudgetItem: tool({
      description: 'Agrega un nuevo item al presupuesto mensual. Requiere confirmación del usuario.',
      parameters: z.object({
        category: z.string().describe('Categoría del nuevo item'),
        type: z.enum(['income', 'expense']).describe('Tipo: income o expense'),
        amount: z.number().describe('Monto presupuestado'),
      }),
    }),

    deleteBudgetItem: tool({
      description: 'Elimina un item del presupuesto mensual. Requiere confirmación del usuario. Acción irreversible.',
      parameters: z.object({
        category: z.string().describe('Categoría del item a eliminar'),
        type: z.enum(['income', 'expense']).describe('Tipo: income o expense'),
      }),
    }),
  }
}
