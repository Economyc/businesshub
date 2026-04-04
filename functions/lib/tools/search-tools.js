import { tool } from 'ai';
import { z } from 'zod';
import { fetchCollection } from '../firestore.js';
// ─── Helpers ───
function tsToIso(val) {
    if (!val)
        return null;
    if (typeof val === 'object' && val !== null && '_seconds' in val) {
        const d = new Date(val._seconds * 1000);
        return d.toISOString().split('T')[0];
    }
    return null;
}
function matchesSearch(value, search) {
    if (!value)
        return false;
    return String(value).toLowerCase().includes(search);
}
// ─── Tools ───
export function createSearchTools(companyId) {
    return {
        searchAll: tool({
            description: 'Busca un término en todas las colecciones: empleados, proveedores, transacciones y contratos. Útil para encontrar información rápidamente sin saber en qué módulo está.',
            parameters: z.object({
                query: z.string().describe('Término de búsqueda'),
            }),
            execute: async ({ query }) => {
                const search = query.toLowerCase();
                const [employees, suppliers, transactions, contracts] = await Promise.all([
                    fetchCollection(companyId, 'employees'),
                    fetchCollection(companyId, 'suppliers'),
                    fetchCollection(companyId, 'transactions'),
                    fetchCollection(companyId, 'contracts'),
                ]);
                // Search employees
                const matchedEmployees = employees
                    .filter((e) => matchesSearch(e.name, search) ||
                    matchesSearch(e.identification, search) ||
                    matchesSearch(e.role, search) ||
                    matchesSearch(e.department, search) ||
                    matchesSearch(e.email, search))
                    .map((e) => ({
                    id: e.id,
                    name: e.name,
                    role: e.role,
                    department: e.department,
                    email: e.email,
                    status: e.status,
                }));
                // Search suppliers
                const matchedSuppliers = suppliers
                    .filter((s) => matchesSearch(s.name, search) ||
                    matchesSearch(s.identification, search) ||
                    matchesSearch(s.category, search) ||
                    matchesSearch(s.contactName, search) ||
                    matchesSearch(s.email, search))
                    .map((s) => ({
                    id: s.id,
                    name: s.name,
                    category: s.category,
                    contactName: s.contactName,
                    status: s.status,
                }));
                // Search transactions
                const matchedTransactions = transactions
                    .filter((t) => matchesSearch(t.concept, search) ||
                    matchesSearch(t.category, search) ||
                    matchesSearch(t.notes, search))
                    .slice(0, 10) // Limit to 10 most relevant
                    .map((t) => ({
                    id: t.id,
                    concept: t.concept,
                    category: t.category,
                    amount: t.amount,
                    type: t.type,
                    date: tsToIso(t.date),
                    status: t.status,
                }));
                // Search contracts
                const matchedContracts = contracts
                    .filter((c) => matchesSearch(c.title, search) ||
                    matchesSearch(c.employeeName, search) ||
                    matchesSearch(c.templateName, search))
                    .map((c) => ({
                    id: c.id,
                    title: c.title,
                    employeeName: c.employeeName,
                    templateName: c.templateName,
                    startDate: tsToIso(c.startDate),
                    endDate: tsToIso(c.endDate),
                }));
                const totalResults = matchedEmployees.length +
                    matchedSuppliers.length +
                    matchedTransactions.length +
                    matchedContracts.length;
                return {
                    query,
                    totalResults,
                    employees: { count: matchedEmployees.length, results: matchedEmployees },
                    suppliers: { count: matchedSuppliers.length, results: matchedSuppliers },
                    transactions: { count: matchedTransactions.length, results: matchedTransactions },
                    contracts: { count: matchedContracts.length, results: matchedContracts },
                };
            },
        }),
    };
}
//# sourceMappingURL=search-tools.js.map