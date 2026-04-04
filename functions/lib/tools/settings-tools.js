import { tool } from 'ai';
import { z } from 'zod';
/**
 * Settings mutation tools — no execute function.
 * Returned to frontend for user confirmation, then executed client-side.
 */
export function createSettingsTools() {
    return {
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
    };
}
//# sourceMappingURL=settings-tools.js.map