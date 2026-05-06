import { z } from 'zod';
export declare function createClosingTools(companyId: string): {
    generateMonthClosingPreview: import("ai").Tool<z.ZodObject<{
        year: z.ZodNumber;
        month: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        month: number;
        year: number;
    }, {
        month: number;
        year: number;
    }>, {
        period: string;
        dateRange: {
            startDate: string;
            endDate: string;
        };
        financialSummary: {
            totalIncome: number;
            totalExpenses: number;
            netProfit: number;
            netMarginPercent: number;
            transactionCount: number;
            topExpenseCategories: {
                category: string;
                total: number;
                count: number;
            }[];
            topIncomeCategories: {
                category: string;
                total: number;
                count: number;
            }[];
        };
        budget: {
            budgetedExpenses: number;
            actualExpenses: number;
            executionPercent: number | null;
        };
        status: {
            overdueCount: number;
            overdueTotal: number;
            pendingCount: number;
            pendingTotal: number;
            pendingRecurringCount: number;
            payrollStatus: string;
            activeEmployees: number;
        };
        pendingActions: string[];
        hasActionsRequired: boolean;
    }> & {
        execute: (args: {
            month: number;
            year: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            period: string;
            dateRange: {
                startDate: string;
                endDate: string;
            };
            financialSummary: {
                totalIncome: number;
                totalExpenses: number;
                netProfit: number;
                netMarginPercent: number;
                transactionCount: number;
                topExpenseCategories: {
                    category: string;
                    total: number;
                    count: number;
                }[];
                topIncomeCategories: {
                    category: string;
                    total: number;
                    count: number;
                }[];
            };
            budget: {
                budgetedExpenses: number;
                actualExpenses: number;
                executionPercent: number | null;
            };
            status: {
                overdueCount: number;
                overdueTotal: number;
                pendingCount: number;
                pendingTotal: number;
                pendingRecurringCount: number;
                payrollStatus: string;
                activeEmployees: number;
            };
            pendingActions: string[];
            hasActionsRequired: boolean;
        }>;
    };
    executeMonthClosing: import("ai").Tool<z.ZodObject<{
        year: z.ZodNumber;
        month: z.ZodNumber;
        periodLabel: z.ZodString;
        generateRecurring: z.ZodBoolean;
        pendingRecurringCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        month: number;
        year: number;
        periodLabel: string;
        generateRecurring: boolean;
        pendingRecurringCount: number;
    }, {
        month: number;
        year: number;
        periodLabel: string;
        generateRecurring: boolean;
        pendingRecurringCount: number;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=closing-tools.d.ts.map