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
function daysBetween(from, to) {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
// ─── Tools ───
export function createCollectionsTools(companyId) {
    return {
        getOverdueCollections: tool({
            description: 'Obtiene la lista priorizada de cuentas por cobrar vencidas o pendientes. Incluye días de mora, montos y plantillas de mensaje de cobro sugeridas para WhatsApp/email.',
            parameters: z.object({
                minDaysOverdue: z
                    .number()
                    .optional()
                    .default(0)
                    .describe('Mínimo de días de mora para incluir (default: 0 = todas las pendientes)'),
            }),
            execute: async ({ minDaysOverdue }) => {
                const transactions = await fetchCollection(companyId, 'transactions');
                const now = new Date();
                // Filter income transactions that are pending or overdue
                const pendingIncome = transactions.filter((t) => t.type === 'income' &&
                    (t.status === 'pending' || t.status === 'overdue'));
                const items = pendingIncome
                    .map((t) => {
                    const txDate = tsToDate(t.date);
                    const daysOverdue = txDate ? daysBetween(txDate, now) : 0;
                    return {
                        id: t.id,
                        concept: String(t.concept ?? ''),
                        category: String(t.category ?? ''),
                        amount: Number(t.amount) || 0,
                        date: tsToIso(t.date),
                        status: String(t.status),
                        daysOverdue: Math.max(0, daysOverdue),
                        urgency: daysOverdue > 60 ? 'critical' : daysOverdue > 30 ? 'high' : daysOverdue > 7 ? 'medium' : 'low',
                    };
                })
                    .filter((item) => item.daysOverdue >= minDaysOverdue)
                    .sort((a, b) => b.daysOverdue - a.daysOverdue);
                const totalOverdue = items.reduce((s, i) => s + i.amount, 0);
                // Generate collection templates
                const templates = items.slice(0, 5).map((item) => ({
                    concept: item.concept,
                    amount: item.amount,
                    daysOverdue: item.daysOverdue,
                    whatsappTemplate: `Hola, buen día. Le escribo para hacer seguimiento al pago pendiente de "${item.concept}" por $${item.amount.toLocaleString('es-CO')}${item.daysOverdue > 0 ? `, que lleva ${item.daysOverdue} días de mora` : ''}. ¿Podría indicarnos cuándo se realizará el pago? Gracias.`,
                    emailSubject: `Recordatorio de pago — ${item.concept}`,
                    emailBody: `Estimado cliente,\n\nNos permitimos recordarle que tiene un pago pendiente por concepto de "${item.concept}" por valor de $${item.amount.toLocaleString('es-CO')}${item.daysOverdue > 0 ? `, con ${item.daysOverdue} días de mora` : ''}.\n\nAgradecemos su pronta gestión.\n\nCordialmente,`,
                }));
                return {
                    totalPending: items.length,
                    totalAmount: totalOverdue,
                    criticalCount: items.filter((i) => i.urgency === 'critical').length,
                    highCount: items.filter((i) => i.urgency === 'high').length,
                    items,
                    collectionTemplates: templates,
                };
            },
        }),
    };
}
//# sourceMappingURL=collections-tools.js.map