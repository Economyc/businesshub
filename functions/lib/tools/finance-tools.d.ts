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
        priority: z.ZodOptional<z.ZodEnum<["immediate", "waiting"]>>;
        payeeName: z.ZodOptional<z.ZodString>;
        documentKind: z.ZodOptional<z.ZodEnum<["invoice", "purchase"]>>;
        overdueOnly: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
        status?: "pending" | "paid" | "overdue" | undefined;
        type?: "income" | "expense" | undefined;
        category?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        payeeName?: string | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        overdueOnly?: boolean | undefined;
    }, {
        startDate: string;
        endDate: string;
        status?: "pending" | "paid" | "overdue" | undefined;
        type?: "income" | "expense" | undefined;
        category?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        payeeName?: string | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        overdueOnly?: boolean | undefined;
    }>, {
        count: number;
        totalAmount: number;
        transactions: {
            priority: {} | null;
            documentKind: {} | null;
            docNumber: {} | null;
            payeeName: string | null;
            withholdingAmount: number;
            payableAmount: number;
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
            priority?: "immediate" | "waiting" | undefined;
            payeeName?: string | undefined;
            documentKind?: "invoice" | "purchase" | undefined;
            overdueOnly?: boolean | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            totalAmount: number;
            transactions: {
                priority: {} | null;
                documentKind: {} | null;
                docNumber: {} | null;
                payeeName: string | null;
                withholdingAmount: number;
                payableAmount: number;
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
    getPendingInvoicesBySupplier: import("ai").Tool<z.ZodObject<{
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        documentKind: z.ZodOptional<z.ZodEnum<["invoice", "purchase"]>>;
        payeeName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        payeeName?: string | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
    }, {
        payeeName?: string | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        limit?: number | undefined;
    }>, {
        documentKind: "invoice" | "purchase";
        supplierCount: number;
        totalInvoices: number;
        totalAmount: number;
        suppliers: {
            supplierName: string;
            count: number;
            total: number;
            oldestDate: string | null;
            immediateCount: number;
            overdueCount: number;
        }[];
    }> & {
        execute: (args: {
            limit: number;
            payeeName?: string | undefined;
            documentKind?: "invoice" | "purchase" | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            documentKind: "invoice" | "purchase";
            supplierCount: number;
            totalInvoices: number;
            totalAmount: number;
            suppliers: {
                supplierName: string;
                count: number;
                total: number;
                oldestDate: string | null;
                immediateCount: number;
                overdueCount: number;
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