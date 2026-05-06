import { tool } from 'ai';
import { z } from 'zod';
import { fetchCollection, fetchSettingsDoc } from '../firestore.js';
import { countPendingRecurring } from '../recurring-generator.js';
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
function filterByPeriod(transactions, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return transactions.filter((t) => {
        const d = tsToDate(t.date);
        return d && d >= start && d <= end;
    });
}
function groupByCategory(txs) {
    const map = new Map();
    for (const t of txs) {
        const cat = String(t.category || 'Sin categoría');
        const existing = map.get(cat) ?? { total: 0, count: 0 };
        existing.total += Number(t.amount) || 0;
        existing.count++;
        map.set(cat, existing);
    }
    return Array.from(map.entries())
        .map(([category, { total, count }]) => ({ category, total, count }))
        .sort((a, b) => b.total - a.total);
}
const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
// ─── Tools ───
export function createClosingTools(companyId) {
    return {
        generateMonthClosingPreview: tool({
            description: 'Genera un preview del cierre de mes: resumen financiero (P&L), transacciones recurrentes pendientes, items vencidos, y estado de nómina. NO ejecuta ninguna acción.',
            parameters: z.object({
                year: z.number().describe('Año del cierre'),
                month: z.number().min(1).max(12).describe('Mes del cierre (1-12)'),
            }),
            execute: async ({ year, month }) => {
                const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
                const [allTxs, budgetDoc, employees, payrolls] = await Promise.all([
                    fetchCollection(companyId, 'transactions'),
                    fetchSettingsDoc(companyId, 'budget'),
                    fetchCollection(companyId, 'employees'),
                    fetchCollection(companyId, 'payrolls'),
                ]);
                // P&L Summary
                const periodTxs = filterByPeriod(allTxs, startDate, endDate);
                const incomeTxs = periodTxs.filter((t) => t.type === 'income');
                const expenseTxs = periodTxs.filter((t) => t.type === 'expense');
                const totalIncome = incomeTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const totalExpenses = expenseTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const netProfit = totalIncome - totalExpenses;
                const netMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
                // Overdue transactions
                const overdueTxs = periodTxs.filter((t) => t.status === 'overdue');
                const pendingTxs = periodTxs.filter((t) => t.status === 'pending');
                const overdueTotal = overdueTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const pendingTotal = pendingTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                // Pending recurring transactions
                const pendingRecurringCount = await countPendingRecurring(companyId);
                // Budget comparison
                const budgetItems = budgetDoc?.items ?? [];
                const totalBudgetedExpenses = budgetItems
                    .filter((i) => i.type === 'expense')
                    .reduce((s, i) => s + i.amount, 0);
                const budgetExecution = totalBudgetedExpenses > 0
                    ? Math.round((totalExpenses / totalBudgetedExpenses) * 100)
                    : null;
                // Payroll status
                const monthPayroll = payrolls.find((p) => Number(p.year) === year && Number(p.month) === month);
                // Active employees
                const activeEmployees = employees.filter((e) => e.status === 'active').length;
                // Pending actions summary
                const pendingActions = [];
                if (pendingRecurringCount > 0) {
                    pendingActions.push(`Generar ${pendingRecurringCount} transacciones recurrentes pendientes`);
                }
                if (overdueTxs.length > 0) {
                    pendingActions.push(`${overdueTxs.length} transacciones vencidas por $${overdueTotal.toLocaleString('es-CO')}`);
                }
                if (pendingTxs.length > 0) {
                    pendingActions.push(`${pendingTxs.length} transacciones pendientes por $${pendingTotal.toLocaleString('es-CO')}`);
                }
                if (!monthPayroll) {
                    pendingActions.push(`Nómina de ${MONTH_NAMES[month - 1]} no ha sido generada`);
                }
                else if (monthPayroll.status === 'draft') {
                    pendingActions.push(`Nómina de ${MONTH_NAMES[month - 1]} está en borrador — falta aprobación`);
                }
                return {
                    period: `${MONTH_NAMES[month - 1]} ${year}`,
                    dateRange: { startDate, endDate },
                    // P&L
                    financialSummary: {
                        totalIncome,
                        totalExpenses,
                        netProfit,
                        netMarginPercent: Math.round(netMargin * 100) / 100,
                        transactionCount: periodTxs.length,
                        topExpenseCategories: groupByCategory(expenseTxs).slice(0, 5),
                        topIncomeCategories: groupByCategory(incomeTxs).slice(0, 3),
                    },
                    // Budget
                    budget: {
                        budgetedExpenses: totalBudgetedExpenses,
                        actualExpenses: totalExpenses,
                        executionPercent: budgetExecution,
                    },
                    // Status
                    status: {
                        overdueCount: overdueTxs.length,
                        overdueTotal,
                        pendingCount: pendingTxs.length,
                        pendingTotal,
                        pendingRecurringCount,
                        payrollStatus: monthPayroll ? String(monthPayroll.status) : 'not_created',
                        activeEmployees,
                    },
                    // Actions needed
                    pendingActions,
                    hasActionsRequired: pendingActions.length > 0,
                };
            },
        }),
        executeMonthClosing: tool({
            description: 'Ejecuta el cierre de mes: genera transacciones recurrentes pendientes. Requiere confirmación del usuario. Usa los datos del preview generado por generateMonthClosingPreview.',
            parameters: z.object({
                year: z.number().describe('Año del cierre'),
                month: z.number().min(1).max(12).describe('Mes del cierre (1-12)'),
                periodLabel: z.string().describe('Etiqueta del periodo (ej: "Marzo 2026")'),
                generateRecurring: z.boolean().describe('Si se deben generar las transacciones recurrentes pendientes'),
                pendingRecurringCount: z.number().describe('Cantidad de recurrentes a generar'),
            }),
            // No execute — handled client-side with confirmation
        }),
    };
}
//# sourceMappingURL=closing-tools.js.map