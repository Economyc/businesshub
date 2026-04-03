import { z } from 'zod';
export declare function createSupplierTools(companyId: string): {
    getSuppliers: import("ai").Tool<z.ZodObject<{
        category: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["active", "expired", "pending"]>>;
    }, "strip", z.ZodTypeAny, {
        status?: "active" | "expired" | "pending" | undefined;
        category?: string | undefined;
    }, {
        status?: "active" | "expired" | "pending" | undefined;
        category?: string | undefined;
    }>, {
        count: number;
        suppliers: {
            id: unknown;
            name: unknown;
            identification: unknown;
            category: unknown;
            contactName: unknown;
            email: unknown;
            phone: unknown;
            contractStart: string | null;
            contractEnd: string | null;
            status: unknown;
        }[];
    }> & {
        execute: (args: {
            status?: "active" | "expired" | "pending" | undefined;
            category?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            suppliers: {
                id: unknown;
                name: unknown;
                identification: unknown;
                category: unknown;
                contactName: unknown;
                email: unknown;
                phone: unknown;
                contractStart: string | null;
                contractEnd: string | null;
                status: unknown;
            }[];
        }>;
    };
    getSupplier: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>, {
        id: unknown;
        name: unknown;
        identification: unknown;
        category: unknown;
        contactName: unknown;
        email: unknown;
        phone: unknown;
        contractStart: string | null;
        contractEnd: string | null;
        status: unknown;
    } | {
        error: string;
    }> & {
        execute: (args: {
            id: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            id: unknown;
            name: unknown;
            identification: unknown;
            category: unknown;
            contactName: unknown;
            email: unknown;
            phone: unknown;
            contractStart: string | null;
            contractEnd: string | null;
            status: unknown;
        } | {
            error: string;
        }>;
    };
};
//# sourceMappingURL=supplier-tools.d.ts.map