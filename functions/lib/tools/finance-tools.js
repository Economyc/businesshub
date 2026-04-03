import { tool } from 'ai';
import { z } from 'zod';
import { fetchCollection, fetchSettingsDoc } from '../firestore.js';
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
function formatTx(t) {
    return {
        id: t.id,
        concept: t.concept,
        category: t.category,
        amount: t.amount,
        type: t.type,
        date: tsToIso(t.date),
        status: t.status,
        notes: t.notes || null,
        sourceType: t.sourceType || null,
    };
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
// ─── Classification (mirrors frontend logic) ───
const COST_OF_SALES_CATS = ['suministros', 'insumos', 'costo de ventas'];
const OTHER_INCOME_CATS = ['otros', 'propinas'];
const OTHER_EXPENSE_CATS = ['impuestos', 'seguros', 'otros'];
function normalizeCat(category) {
    return category
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(' > ')[0]
        .trim();
}
function classifyExpense(category) {
    const norm = normalizeCat(category);
    if (COST_OF_SALES_CATS.some((c) => norm.includes(c)))
        return 'cost_of_sales';
    if (OTHER_EXPENSE_CATS.some((c) => norm === c))
        return 'other_expense';
    return 'operating';
}
function classifyIncome(category) {
    const norm = normalizeCat(category);
    if (OTHER_INCOME_CATS.some((c) => norm === c))
        return 'other_income';
    return 'revenue';
}
// ─── Tools ───
export function createFinanceTools(companyId) {
    return {
        getTransactions: tool({
            description: 'Obtiene transacciones financieras filtradas por periodo, tipo y/o categoría.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
                endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
                type: z.enum(['income', 'expense']).optional().describe('Filtrar por tipo: income o expense'),
                category: z.string().optional().describe('Filtrar por categoría'),
                status: z.enum(['paid', 'pending', 'overdue']).optional().describe('Filtrar por estado'),
            }),
            execute: async ({ startDate, endDate, type, category, status }) => {
                const all = await fetchCollection(companyId, 'transactions');
                let filtered = filterByPeriod(all, startDate, endDate);
                if (type)
                    filtered = filtered.filter((t) => t.type === type);
                if (category) {
                    filtered = filtered.filter((t) => String(t.category).toLowerCase().includes(category.toLowerCase()));
                }
                if (status)
                    filtered = filtered.filter((t) => t.status === status);
                const totalAmount = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                return {
                    count: filtered.length,
                    totalAmount,
                    transactions: filtered.map((t) => formatTx(t)),
                };
            },
        }),
        getCashFlow: tool({
            description: 'Calcula el flujo de caja para un periodo: ingresos, gastos, balance, desglose por categoría.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
                endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
            }),
            execute: async ({ startDate, endDate }) => {
                const all = await fetchCollection(companyId, 'transactions');
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                const paid = all.filter((t) => t.status === 'paid');
                // Opening balance: all paid before period
                const beforePeriod = paid.filter((t) => {
                    const d = tsToDate(t.date);
                    return d && d < start;
                });
                const openingBalance = beforePeriod.reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
                // Period transactions
                const periodPaid = paid.filter((t) => {
                    const d = tsToDate(t.date);
                    return d && d >= start && d <= end;
                });
                const incomeTxs = periodPaid.filter((t) => t.type === 'income');
                const expenseTxs = periodPaid.filter((t) => t.type === 'expense');
                const totalIncome = incomeTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const totalExpenses = expenseTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const netFlow = totalIncome - totalExpenses;
                // Pending
                const periodPending = all.filter((t) => {
                    const d = tsToDate(t.date);
                    return d && d >= start && d <= end && (t.status === 'pending' || t.status === 'overdue');
                });
                const pendingIncome = periodPending
                    .filter((t) => t.type === 'income')
                    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const pendingExpenses = periodPending
                    .filter((t) => t.type === 'expense')
                    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
                return {
                    openingBalance,
                    totalIncome,
                    totalExpenses,
                    netFlow,
                    closingBalance: openingBalance + netFlow,
                    incomeByCategory: groupByCategory(incomeTxs),
                    expensesByCategory: groupByCategory(expenseTxs),
                    pendingIncome,
                    pendingExpenses,
                    pendingCount: periodPending.length,
                    transactionCount: periodPaid.length,
                };
            },
        }),
        getIncomeStatement: tool({
            description: 'Genera el estado de resultados (P&L) para un periodo: ingresos, costos, utilidad bruta, gastos operacionales, utilidad neta y márgenes.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
                endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
            }),
            execute: async ({ startDate, endDate }) => {
                const all = await fetchCollection(companyId, 'transactions');
                const period = filterByPeriod(all, startDate, endDate);
                const incomeTxs = period.filter((t) => t.type === 'income');
                const expenseTxs = period.filter((t) => t.type === 'expense');
                // Classify income
                const revenueTxs = incomeTxs.filter((t) => classifyIncome(String(t.category)) === 'revenue');
                const otherIncomeTxs = incomeTxs.filter((t) => classifyIncome(String(t.category)) === 'other_income');
                // Classify expenses
                const costOfSalesTxs = expenseTxs.filter((t) => classifyExpense(String(t.category)) === 'cost_of_sales');
                const operatingTxs = expenseTxs.filter((t) => classifyExpense(String(t.category)) === 'operating');
                const otherExpenseTxs = expenseTxs.filter((t) => classifyExpense(String(t.category)) === 'other_expense');
                const revenue = revenueTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const costOfSales = costOfSalesTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const grossProfit = revenue - costOfSales;
                const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
                const operatingExpenses = operatingTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const operatingProfit = grossProfit - operatingExpenses;
                const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;
                const otherIncome = otherIncomeTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const otherExpenses = otherExpenseTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const netProfit = operatingProfit + otherIncome - otherExpenses;
                const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
                return {
                    revenue: { total: revenue, categories: groupByCategory(revenueTxs) },
                    costOfSales: { total: costOfSales, categories: groupByCategory(costOfSalesTxs) },
                    grossProfit,
                    grossMarginPercent: Math.round(grossMargin * 100) / 100,
                    operatingExpenses: { total: operatingExpenses, categories: groupByCategory(operatingTxs) },
                    operatingProfit,
                    operatingMarginPercent: Math.round(operatingMargin * 100) / 100,
                    otherIncome: { total: otherIncome, categories: groupByCategory(otherIncomeTxs) },
                    otherExpenses: { total: otherExpenses, categories: groupByCategory(otherExpenseTxs) },
                    netProfit,
                    netMarginPercent: Math.round(netMargin * 100) / 100,
                    transactionCount: period.length,
                };
            },
        }),
        getBudgetComparison: tool({
            description: 'Compara el presupuesto configurado contra los montos reales del periodo.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
                endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
            }),
            execute: async ({ startDate, endDate }) => {
                const [all, budgetDoc] = await Promise.all([
                    fetchCollection(companyId, 'transactions'),
                    fetchSettingsDoc(companyId, 'budget'),
                ]);
                const budgetItems = budgetDoc?.items ?? [];
                const period = filterByPeriod(all, startDate, endDate);
                // Group actual amounts
                const actualMap = new Map();
                for (const t of period) {
                    const key = `${t.category}|${t.type}`;
                    actualMap.set(key, (actualMap.get(key) ?? 0) + (Number(t.amount) || 0));
                }
                const rows = budgetItems.map((item) => {
                    const key = `${item.category}|${item.type}`;
                    const actual = actualMap.get(key) ?? 0;
                    const difference = item.type === 'income' ? actual - item.amount : item.amount - actual;
                    const execution = item.amount > 0 ? (actual / item.amount) * 100 : 0;
                    return {
                        category: item.category,
                        type: item.type,
                        budgeted: item.amount,
                        actual,
                        difference,
                        executionPercent: Math.round(execution * 100) / 100,
                    };
                });
                // Categories with actuals but no budget
                for (const [key, actual] of actualMap) {
                    const [category, type] = key.split('|');
                    if (!budgetItems.some((i) => i.category === category && i.type === type)) {
                        rows.push({
                            category,
                            type,
                            budgeted: 0,
                            actual,
                            difference: type === 'income' ? actual : -actual,
                            executionPercent: 0,
                        });
                    }
                }
                const incomeRows = rows.filter((r) => r.type === 'income');
                const expenseRows = rows.filter((r) => r.type === 'expense');
                return {
                    rows,
                    totalBudgetedIncome: incomeRows.reduce((s, r) => s + r.budgeted, 0),
                    totalActualIncome: incomeRows.reduce((s, r) => s + r.actual, 0),
                    totalBudgetedExpenses: expenseRows.reduce((s, r) => s + r.budgeted, 0),
                    totalActualExpenses: expenseRows.reduce((s, r) => s + r.actual, 0),
                };
            },
        }),
        getExpensesByCategory: tool({
            description: 'Obtiene el desglose de gastos por categoría para un periodo.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio en formato YYYY-MM-DD'),
                endDate: z.string().describe('Fecha fin en formato YYYY-MM-DD'),
            }),
            execute: async ({ startDate, endDate }) => {
                const all = await fetchCollection(companyId, 'transactions');
                const period = filterByPeriod(all, startDate, endDate);
                const expenses = period.filter((t) => t.type === 'expense');
                const total = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                return {
                    totalExpenses: total,
                    transactionCount: expenses.length,
                    categories: groupByCategory(expenses),
                };
            },
        }),
    };
}
//# sourceMappingURL=finance-tools.js.map