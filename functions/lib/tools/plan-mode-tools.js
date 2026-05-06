import { tool } from 'ai';
import { z } from 'zod';
// Wave 5.3 — Multi-step plans con review humano.
//
// El agente devuelve un plan de N pasos antes de tocar el negocio. El cliente
// renderiza el plan, el usuario edita/aprueba/cancela, y luego el cliente
// ejecuta cada paso secuencialmente reusando el mismo `executeMutation()` que
// usan las confirmaciones individuales.
//
// La tool NO tiene `execute()` — es client-rendered, igual que
// `createPayrollDraft` o `executeMonthClosing`. Lo único que viaja al cliente
// son los args (el plan completo).
const PlanStepSchema = z.object({
    id: z.string().describe('Identificador estable del paso (ej: "step-1").'),
    label: z
        .string()
        .describe('Descripción humana del paso (ej: "Validar transacciones del mes").'),
    toolName: z
        .string()
        .describe('Nombre exacto de la tool a ejecutar (ej: "executeMonthClosing").'),
    toolArgs: z
        .record(z.unknown())
        .describe('Argumentos para la tool, tal como se pasarían a executeMutation.'),
    optional: z
        .boolean()
        .optional()
        .describe('Si true, el paso queda desmarcado por defecto en el review.'),
});
export function createPlanModeTools() {
    return {
        proposeMultiStepPlan: tool({
            description: 'Propone un plan de varios pasos al usuario para tareas complejas (cierre mensual, nómina completa, reconcile multi-mes, reportes ejecutivos con envío). NO ejecuta nada. El cliente renderiza el plan y el usuario lo aprueba o edita antes de cualquier ejecución. Úsala SIEMPRE antes de ejecutar pasos individuales en tareas multi-fase.',
            parameters: z.object({
                title: z
                    .string()
                    .describe('Título del plan visible al usuario (ej: "Cierre de Abril 2026").'),
                rationale: z
                    .string()
                    .describe('Explicación corta del porqué de este plan: qué problema resuelve y por qué en este orden.'),
                steps: z
                    .array(PlanStepSchema)
                    .min(1)
                    .describe('Lista ordenada de pasos. El cliente los ejecuta en este orden.'),
            }),
            // Sin execute(): client-rendered. Requiere aprobación humana.
        }),
    };
}
//# sourceMappingURL=plan-mode-tools.js.map