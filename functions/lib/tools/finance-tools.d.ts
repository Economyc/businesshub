import { z } from 'zod';
export interface CategoryBreakdown {
    category: string;
    total: number;
    count: number;
}
export declare function createFinanceTools(companyId: string): {
    getTransactions: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        type: z.ZodOptional<z.ZodEnum<["income", "expense"]>>;
        category: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["paid", "pending", "overdue"]>>;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
        status?: "pending" | "paid" | "overdue" | undefined;
        type?: "income" | "expense" | undefined;
        category?: string | undefined;
    }, {
        startDate: string;
        endDate: string;
        status?: "pending" | "paid" | "overdue" | undefined;
        type?: "income" | "expense" | undefined;
        category?: string | undefined;
    }>, {
        count: number;
        totalAmount: number;
        transactions: {
            id: unknown;
            concept: unknown;
            category: unknown;
            amount: unknown;
            type: unknown;
            date: string | null;
            status: unknown;
            notes: {} | null;
            sourceType: {} | null;
        }[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
            status?: "pending" | "paid" | "overdue" | undefined;
            type?: "income" | "expense" | undefined;
            category?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            totalAmount: number;
            transactions: {
                id: unknown;
                concept: unknown;
                category: unknown;
                amount: unknown;
                type: unknown;
                date: string | null;
                status: unknown;
                notes: {} | null;
                sourceType: {} | null;
            }[];
        }>;
    };
    getCashFlow: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        openingBalance: number;
        totalIncome: number;
        totalExpenses: number;
        netFlow: number;
        closingBalance: number;
        incomeByCategory: CategoryBreakdown[];
        expensesByCategory: CategoryBreakdown[];
        pendingIncome: number;
        pendingExpenses: number;
        pendingCount: number;
        transactionCount: number;
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            openingBalance: number;
            totalIncome: number;
            totalExpenses: number;
            netFlow: number;
            closingBalance: number;
            incomeByCategory: CategoryBreakdown[];
            expensesByCategory: CategoryBreakdown[];
            pendingIncome: number;
            pendingExpenses: number;
            pendingCount: number;
            transactionCount: number;
        }>;
    };
    getIncomeStatement: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        revenue: {
            total: number;
            categories: CategoryBreakdown[];
        };
        costOfSales: {
            total: number;
            categories: CategoryBreakdown[];
        };
        grossProfit: number;
        grossMarginPercent: number;
        operatingExpenses: {
            total: number;
            categories: CategoryBreakdown[];
        };
        operatingProfit: number;
        operatingMarginPercent: number;
        otherIncome: {
            total: number;
            categories: CategoryBreakdown[];
        };
        otherExpenses: {
            total: number;
            categories: CategoryBreakdown[];
        };
        netProfit: number;
        netMarginPercent: number;
        transactionCount: number;
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            revenue: {
                total: number;
                categories: CategoryBreakdown[];
            };
            costOfSales: {
                total: number;
                categories: CategoryBreakdown[];
            };
            grossProfit: number;
            grossMarginPercent: number;
            operatingExpenses: {
                total: number;
                categories: CategoryBreakdown[];
            };
            operatingProfit: number;
            operatingMarginPercent: number;
            otherIncome: {
                total: number;
                categories: CategoryBreakdown[];
            };
            otherExpenses: {
                total: number;
                categories: CategoryBreakdown[];
            };
            netProfit: number;
            netMarginPercent: number;
            transactionCount: number;
        }>;
    };
    getBudgetComparison: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        rows: {
            category: string;
            type: string;
            budgeted: number;
            actual: number;
            difference: number;
            executionPercent: number;
        }[];
        totalBudgetedIncome: number;
        totalActualIncome: number;
        totalBudgetedExpenses: number;
        totalActualExpenses: number;
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            rows: {
                category: string;
                type: string;
                budgeted: number;
                actual: number;
                difference: number;
                executionPercent: number;
            }[];
            totalBudgetedIncome: number;
            totalActualIncome: number;
            totalBudgetedExpenses: number;
            totalActualExpenses: number;
        }>;
    };
    getExpensesByCategory: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        totalExpenses: number;
        transactionCount: number;
        categories: CategoryBreakdown[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalExpenses: number;
            transactionCount: number;
            categories: CategoryBreakdown[];
        }>;
    };
};
//# sourceMappingURL=finance-tools.d.ts.map