import { z } from 'zod';
/**
 * Mutation tools do NOT have an `execute` function.
 * The Vercel AI SDK will return these as tool calls to the client,
 * where the user must confirm before the action is executed.
 *
 * Para mostrar un diff "antes → después" en el ConfirmationCard, el CLIENTE
 * lee el documento actual desde Firestore al recibir la tool-invocation
 * (Opción B). No se duplica el estado en el server.
 *
 * TODO: si tools.length > 5, considerar Opción A — un wrapper "preview tool"
 * server-side que devuelva { previousState, proposedChanges } para batchear
 * cambios en una sola lectura.
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
        payeeType: z.ZodOptional<z.ZodEnum<["partner", "employee", "supplier", "external"]>>;
        payeeName: z.ZodOptional<z.ZodString>;
        targetCompanyName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "paid";
        type: "income" | "expense";
        date: string;
        category: string;
        concept: string;
        amount: number;
        notes?: string | undefined;
        payeeName?: string | undefined;
        payeeType?: "partner" | "employee" | "supplier" | "external" | undefined;
        targetCompanyName?: string | undefined;
    }, {
        type: "income" | "expense";
        date: string;
        category: string;
        concept: string;
        amount: number;
        status?: "pending" | "paid" | undefined;
        notes?: string | undefined;
        payeeName?: string | undefined;
        payeeType?: "partner" | "employee" | "supplier" | "external" | undefined;
        targetCompanyName?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    createSplitExpense: import("ai").Tool<z.ZodObject<{
        concept: z.ZodString;
        category: z.ZodString;
        totalAmount: z.ZodNumber;
        date: z.ZodString;
        payeeType: z.ZodEnum<["partner", "employee", "supplier", "external"]>;
        payeeName: z.ZodString;
        splits: z.ZodArray<z.ZodObject<{
            companyName: z.ZodString;
            amount: z.ZodOptional<z.ZodNumber>;
            percentage: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            companyName: string;
            amount?: number | undefined;
            percentage?: number | undefined;
        }, {
            companyName: string;
            amount?: number | undefined;
            percentage?: number | undefined;
        }>, "many">;
        splitMode: z.ZodEnum<["equal", "amounts", "percentages"]>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        category: string;
        concept: string;
        payeeName: string;
        totalAmount: number;
        payeeType: "partner" | "employee" | "supplier" | "external";
        splits: {
            companyName: string;
            amount?: number | undefined;
            percentage?: number | undefined;
        }[];
        splitMode: "equal" | "amounts" | "percentages";
        notes?: string | undefined;
    }, {
        date: string;
        category: string;
        concept: string;
        payeeName: string;
        totalAmount: number;
        payeeType: "partner" | "employee" | "supplier" | "external";
        splits: {
            companyName: string;
            amount?: number | undefined;
            percentage?: number | undefined;
        }[];
        splitMode: "equal" | "amounts" | "percentages";
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
        priority: z.ZodOptional<z.ZodEnum<["immediate", "waiting"]>>;
        documentKind: z.ZodOptional<z.ZodEnum<["invoice", "purchase"]>>;
        paidDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status?: "pending" | "paid" | undefined;
        type?: "income" | "expense" | undefined;
        date?: string | undefined;
        category?: string | undefined;
        concept?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        paidDate?: string | undefined;
    }, {
        id: string;
        status?: "pending" | "paid" | undefined;
        type?: "income" | "expense" | undefined;
        date?: string | undefined;
        category?: string | undefined;
        concept?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        paidDate?: string | undefined;
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
    quickMarkInvoiceAsPaid: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        concept: z.ZodString;
        amount: z.ZodNumber;
        supplierName: z.ZodOptional<z.ZodString>;
        paidDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        concept: string;
        amount: number;
        supplierName?: string | undefined;
        paidDate?: string | undefined;
    }, {
        id: string;
        concept: string;
        amount: number;
        supplierName?: string | undefined;
        paidDate?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    bulkMarkAsPaid: import("ai").Tool<z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            concept: z.ZodString;
            amount: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            concept: string;
            amount?: number | undefined;
        }, {
            id: string;
            concept: string;
            amount?: number | undefined;
        }>, "many">;
        summary: z.ZodString;
        paidDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        items: {
            id: string;
            concept: string;
            amount?: number | undefined;
        }[];
        summary: string;
        paidDate?: string | undefined;
    }, {
        items: {
            id: string;
            concept: string;
            amount?: number | undefined;
        }[];
        summary: string;
        paidDate?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    bulkSetPriority: import("ai").Tool<z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            concept: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            concept: string;
        }, {
            id: string;
            concept: string;
        }>, "many">;
        priority: z.ZodEnum<["immediate", "waiting"]>;
        summary: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        priority: "immediate" | "waiting";
        items: {
            id: string;
            concept: string;
        }[];
        summary: string;
    }, {
        priority: "immediate" | "waiting";
        items: {
            id: string;
            concept: string;
        }[];
        summary: string;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=mutation-tools.d.ts.map