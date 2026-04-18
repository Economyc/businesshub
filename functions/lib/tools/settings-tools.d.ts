import { z } from 'zod';
/**
 * Settings tools — mix de reads (con execute) y mutations (sin execute, ejecutadas
 * en cliente tras confirmación del usuario).
 */
export declare function createSettingsTools(companyId: string): {
    getBudget: import("ai").Tool<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>, {
        itemCount: number;
        totalBudgetedIncome: number;
        totalBudgetedExpense: number;
        netBudgeted: number;
        income: {
            category: string;
            type: string;
            amount: number;
        }[];
        expense: {
            category: string;
            type: string;
            amount: number;
        }[];
    }> & {
        execute: (args: {}, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            itemCount: number;
            totalBudgetedIncome: number;
            totalBudgetedExpense: number;
            netBudgeted: number;
            income: {
                category: string;
                type: string;
                amount: number;
            }[];
            expense: {
                category: string;
                type: string;
                amount: number;
            }[];
        }>;
    };
    updateBudget: import("ai").Tool<z.ZodObject<{
        category: z.ZodString;
        type: z.ZodEnum<["income", "expense"]>;
        amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "income" | "expense";
        category: string;
        amount: number;
    }, {
        type: "income" | "expense";
        category: string;
        amount: number;
    }>, unknown> & {
        execute: undefined;
    };
    addBudgetItem: import("ai").Tool<z.ZodObject<{
        category: z.ZodString;
        type: z.ZodEnum<["income", "expense"]>;
        amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "income" | "expense";
        category: string;
        amount: number;
    }, {
        type: "income" | "expense";
        category: string;
        amount: number;
    }>, unknown> & {
        execute: undefined;
    };
    deleteBudgetItem: import("ai").Tool<z.ZodObject<{
        category: z.ZodString;
        type: z.ZodEnum<["income", "expense"]>;
    }, "strip", z.ZodTypeAny, {
        type: "income" | "expense";
        category: string;
    }, {
        type: "income" | "expense";
        category: string;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=settings-tools.d.ts.map