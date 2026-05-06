import { tool } from 'ai';
import { z } from 'zod';
import { fetchCollection, fetchDocument } from '../firestore.js';
function serializeTimestamp(val) {
    if (!val)
        return null;
    if (typeof val === 'object' && val !== null && '_seconds' in val) {
        const ts = val;
        return new Date(ts._seconds * 1000).toISOString().split('T')[0];
    }
    return String(val);
}
function formatSupplier(s) {
    return {
        id: s.id,
        name: s.name,
        identification: s.identification,
        category: s.category,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        contractStart: serializeTimestamp(s.contractStart),
        contractEnd: serializeTimestamp(s.contractEnd),
        status: s.status,
    };
}
export function createSupplierTools(companyId) {
    return {
        getSuppliers: tool({
            description: 'Obtiene la lista de proveedores. Puede filtrar por categoría y/o estado.',
            parameters: z.object({
                category: z.string().optional().describe('Filtrar por categoría'),
                status: z.enum(['active', 'expired', 'pending']).optional().describe('Filtrar por estado'),
            }),
            execute: async ({ category, status }) => {
                const suppliers = await fetchCollection(companyId, 'suppliers');
                let filtered = suppliers;
                if (category) {
                    filtered = filtered.filter((s) => String(s.category).toLowerCase() === category.toLowerCase());
                }
                if (status) {
                    filtered = filtered.filter((s) => s.status === status);
                }
                return {
                    count: filtered.length,
                    suppliers: filtered.map(formatSupplier),
                };
            },
        }),
        getSupplier: tool({
            description: 'Obtiene el detalle de un proveedor por su ID.',
            parameters: z.object({
                id: z.string().describe('ID del proveedor'),
            }),
            execute: async ({ id }) => {
                const supplier = await fetchDocument(companyId, 'suppliers', id);
                if (!supplier)
                    return { error: 'Proveedor no encontrado' };
                return formatSupplier(supplier);
            },
        }),
    };
}
//# sourceMappingURL=supplier-tools.js.map