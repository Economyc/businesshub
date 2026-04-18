import { z } from 'zod';
/**
 * Mutation tools do NOT have an `execute` function.
 * The Vercel AI SDK will return these as tool calls to the client,
 * where the user must confirm before the action is executed.
 */
export declare function createMutationTools(): {
    createEmployee: import("ai").Tool<z.ZodObject<{
        name: z.ZodString;
        identification: z.ZodString;
        role: z.ZodString;
        department: z.ZodString;
        email: z.ZodString;
        phone: z.ZodString;
        salary: z.ZodNumber;
        startDate: z.ZodString;
        status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["active", "inactive"]>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        identification: string;
        role: string;
        department: string;
        email: string;
        phone: string;
        salary: number;
        startDate: string;
        status: "active" | "inactive";
    }, {
        name: string;
        identification: string;
        role: string;
        department: string;
        email: string;
        phone: string;
        salary: number;
        startDate: string;
        status?: "active" | "inactive" | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    updateEmployee: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        role: z.ZodOptional<z.ZodString>;
        department: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        salary: z.ZodOptional<z.ZodNumber>;
        status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        role?: string | undefined;
        department?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        salary?: number | undefined;
        status?: "active" | "inactive" | undefined;
    }, {
        id: string;
        name?: string | undefined;
        role?: string | undefined;
        department?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        salary?: number | undefined;
        status?: "active" | "inactive" | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    deleteEmployee: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>, unknown> & {
        execute: undefined;
    };
    createSupplier: import("ai").Tool<z.ZodObject<{
        name: z.ZodString;
        identification: z.ZodString;
        category: z.ZodString;
        contactName: z.ZodString;
        email: z.ZodString;
        phone: z.ZodString;
        contractStart: z.ZodString;
        contractEnd: z.ZodString;
        status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["active", "expired", "pending"]>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        identification: string;
        email: string;
        phone: string;
        status: "active" | "expired" | "pending";
        category: string;
        contactName: string;
        contractStart: string;
        contractEnd: string;
    }, {
        name: string;
        identification: string;
        email: string;
        phone: string;
        category: string;
        contactName: string;
        contractStart: string;
        contractEnd: string;
        status?: "active" | "expired" | "pending" | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    updateSupplier: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        contactName: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["active", "expired", "pending"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        status?: "active" | "expired" | "pending" | undefined;
        category?: string | undefined;
        contactName?: string | undefined;
    }, {
        id: string;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        status?: "active" | "expired" | "pending" | undefined;
        category?: string | undefined;
        contactName?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    deleteSupplier: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>, unknown> & {
        execute: undefined;
    };
    createTransaction: import("ai").Tool<z.ZodObject<{
        concept: z.ZodString;
        category: z.ZodString;
        amount: z.ZodNumber;
        type: z.ZodEnum<["income", "expense"]>;
        date: z.ZodString;
        status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["paid", "pending"]>>>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "paid";
        type: "income" | "expense";
        date: string;
        category: string;
        concept: string;
        amount: number;
        notes?: string | undefined;
    }, {
        type: "income" | "expense";
        date: string;
        category: string;
        concept: string;
        amount: number;
        status?: "pending" | "paid" | undefined;
        notes?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    updateTransaction: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        concept: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        type: z.ZodOptional<z.ZodEnum<["income", "expense"]>>;
        date: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["paid", "pending"]>>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status?: "pending" | "paid" | undefined;
        type?: "income" | "expense" | undefined;
        date?: string | undefined;
        category?: string | undefined;
        concept?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
    }, {
        id: string;
        status?: "pending" | "paid" | undefined;
        type?: "income" | "expense" | undefined;
        date?: string | undefined;
        category?: string | undefined;
        concept?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    deleteTransaction: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        concept: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        concept: string;
    }, {
        id: string;
        concept: string;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=mutation-tools.d.ts.map