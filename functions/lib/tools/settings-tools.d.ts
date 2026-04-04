import { z } from 'zod';
/**
 * Settings mutation tools — no execute function.
 * Returned to frontend for user confirmation, then executed client-side.
 */
export declare function createSettingsTools(): {
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
};
//# sourceMappingURL=settings-tools.d.ts.map