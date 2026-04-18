import { tool } from 'ai';
import { z } from 'zod';
import { fetchCollection } from '../firestore.js';
// ─── Helpers ───
function tsToDate(val) {
    if (!val)
        return null;
    if (typeof val === 'object' && val !== null && '_seconds' in val) {
        return new Date(val._seconds * 1000);
    }
    return null;
}
function tsToIso(val) {
    const d = tsToDate(val);
    return d ? d.toISOString().split('T')[0] : null;
}
function formatContract(c) {
    return {
        id: c.id,
        title: c.title,
        employeeName: c.employeeName,
        employeeId: c.employeeId,
        templateName: c.templateName,
        status: c.status,
        startDate: tsToIso(c.startDate) || c.startDate,
        endDate: tsToIso(c.endDate) || c.endDate,
        createdAt: tsToIso(c.createdAt),
        salary: c.salary,
        position: c.position,
        department: c.department,
    };
}
function formatTemplate(t) {
    return {
        id: t.id,
        name: t.name,
        description: t.description,
        clauseCount: Array.isArray(t.clauses) ? t.clauses.length : 0,
    };
}
// ─── Tools ───
export function createDocumentTools(companyId) {
    return {
        getContracts: tool({
            description: 'Obtiene la lista de contratos generados. Puede filtrar por empleado o estado.',
            parameters: z.object({
                employeeName: z.string().optional().describe('Filtrar por nombre de empleado'),
                status: z.string().optional().describe('Filtrar por estado del contrato'),
            }),
            execute: async ({ employeeName, status }) => {
                const contracts = await fetchCollection(companyId, 'contracts');
                let filtered = contracts;
                if (employeeName) {
                    const search = employeeName.toLowerCase();
                    filtered = filtered.filter((c) => String(c.employeeName ?? '').toLowerCase().includes(search));
                }
                if (status) {
                    filtered = filtered.filter((c) => c.status === status);
                }
                return {
                    count: filtered.length,
                    contracts: filtered.map(formatContract),
                };
            },
        }),
        getContractTemplates: tool({
            description: 'Obtiene las plantillas de contratos disponibles.',
            parameters: z.object({}),
            execute: async () => {
                const templates = await fetchCollection(companyId, 'contract_templates');
                return {
                    count: templates.length,
                    templates: templates.map(formatTemplate),
                };
            },
        }),
        getExpiringContracts: tool({
            description: 'Obtiene contratos que vencen dentro de los próximos N días.',
            parameters: z.object({
                days: z.number().optional().default(30).describe('Días a futuro para buscar vencimientos (default: 30)'),
            }),
            execute: async ({ days }) => {
                const contracts = await fetchCollection(companyId, 'contracts');
                const now = new Date();
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + days);
                const expiring = contracts.filter((c) => {
                    const end = tsToDate(c.endDate);
                    if (!end)
                        return false;
                    return end >= now && end <= futureDate;
                });
                const expired = contracts.filter((c) => {
                    const end = tsToDate(c.endDate);
                    if (!end)
                        return false;
                    return end < now;
                });
                return {
                    expiringCount: expiring.length,
                    expiredCount: expired.length,
                    expiring: expiring.map(formatContract),
                    expired: expired.map(formatContract),
                    searchDays: days,
                };
            },
        }),
        // ─── Mutations (sin execute, confirmación en cliente) ───
        createContractTemplate: tool({
            description: 'Crea una nueva plantilla de contrato. Requiere confirmación del usuario.',
            parameters: z.object({
                name: z.string().describe('Nombre de la plantilla'),
                contractType: z
                    .enum(['indefinido', 'fijo', 'obra_labor', 'aprendizaje', 'prestacion_servicios'])
                    .describe('Tipo de contrato'),
                position: z.string().describe('Cargo al que aplica la plantilla'),
                description: z.string().describe('Descripción breve'),
                clauses: z
                    .array(z.object({
                    id: z.string(),
                    title: z.string(),
                    content: z.string(),
                    isRequired: z.boolean(),
                    isEditable: z.boolean(),
                    order: z.number(),
                    category: z.enum(['mandatory', 'optional', 'position_specific']),
                }))
                    .describe('Cláusulas de la plantilla'),
                isDefault: z.boolean().optional().default(false).describe('Si es la plantilla por defecto para el tipo'),
            }),
        }),
        updateContractTemplate: tool({
            description: 'Actualiza una plantilla de contrato existente. Requiere confirmación del usuario.',
            parameters: z.object({
                id: z.string().describe('ID de la plantilla'),
                name: z.string().optional(),
                position: z.string().optional(),
                description: z.string().optional(),
                isDefault: z.boolean().optional(),
            }),
        }),
        deleteContractTemplate: tool({
            description: 'Elimina una plantilla de contrato. Requiere confirmación del usuario. Acción irreversible.',
            parameters: z.object({
                id: z.string().describe('ID de la plantilla'),
                name: z.string().describe('Nombre de la plantilla (para confirmación)'),
            }),
        }),
        createContractFromTemplate: tool({
            description: 'Genera un contrato para un empleado desde una plantilla. Requiere confirmación del usuario. El PDF se genera luego desde la UI.',
            parameters: z.object({
                templateId: z.string().describe('ID de la plantilla base'),
                employeeId: z.string().optional().describe('ID del empleado (opcional si se crea externo)'),
                employeeName: z.string().describe('Nombre del empleado'),
                employeeIdentification: z.string().describe('Cédula o identificación del empleado'),
                position: z.string().describe('Cargo'),
                salary: z.number().describe('Salario mensual'),
                startDate: z.string().describe('Fecha de inicio (YYYY-MM-DD)'),
                endDate: z.string().optional().describe('Fecha de fin (YYYY-MM-DD) — solo para contratos a término fijo'),
            }),
        }),
    };
}
//# sourceMappingURL=document-tools.js.map