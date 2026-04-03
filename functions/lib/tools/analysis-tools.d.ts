import { z } from 'zod';
export interface CategoryTotal {
    category: string;
    total: number;
    count: number;
}
export declare function createAnalysisTools(companyId: string): {
    analyzeExpensesTrend: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        compareWithPrevious: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
        compareWithPrevious: boolean;
    }, {
        startDate: string;
        endDate: string;
        compareWithPrevious?: boolean | undefined;
    }>, Record<string, unknown>> & {
        execute: (args: {
            startDate: string;
            endDate: string;
            compareWithPrevious: boolean;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<Record<string, unknown>>;
    };
    analyzeSupplierPrices: import("ai").Tool<z.ZodObject<{
        months: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        months: number;
    }, {
        months?: number | undefined;
    }>, {
        periodMonths: number;
        totalPurchases: number;
        totalSpent: number;
        supplierBreakdown: {
            supplierId: string;
            supplierName: string;
            purchaseCount: number;
            totalSpent: number;
            averagePerPurchase: number;
        }[];
    }> & {
        execute: (args: {
            months: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            periodMonths: number;
            totalPurchases: number;
            totalSpent: number;
            supplierBreakdown: {
                supplierId: string;
                supplierName: string;
                purchaseCount: number;
                totalSpent: number;
                averagePerPurchase: number;
            }[];
        }>;
    };
    generateExecutiveReport: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        period: {
            startDate: string;
            endDate: string;
        };
        totalIncome: number;
        totalExpenses: number;
        netProfit: number;
        netMarginPercent: number;
        transactionCount: number;
        incomeChangeVsPrevPeriod: number;
        expenseChangeVsPrevPeriod: number;
        budgetedIncome: number;
        budgetedExpenses: number;
        budgetExpenseExecution: number | null;
        activeEmployees: number;
        activeSuppliers: number;
        pendingTransactions: number;
        overdueAmount: number;
        topExpenseCategories: CategoryTotal[];
        alerts: string[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            period: {
                startDate: string;
                endDate: string;
            };
            totalIncome: number;
            totalExpenses: number;
            netProfit: number;
            netMarginPercent: number;
            transactionCount: number;
            incomeChangeVsPrevPeriod: number;
            expenseChangeVsPrevPeriod: number;
            budgetedIncome: number;
            budgetedExpenses: number;
            budgetExpenseExecution: number | null;
            activeEmployees: number;
            activeSuppliers: number;
            pendingTransactions: number;
            overdueAmount: number;
            topExpenseCategories: CategoryTotal[];
            alerts: string[];
        }>;
    };
};
//# sourceMappingURL=analysis-tools.d.ts.map