import { z } from 'zod';
export declare function createPayableTools(companyId: string): {
    createPayableDocument: import("ai").Tool<z.ZodObject<{
        documentKind: z.ZodEnum<["invoice", "purchase"]>;
        supplierName: z.ZodString;
        docNumber: z.ZodString;
        date: z.ZodString;
        amount: z.ZodNumber;
        category: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        category: string;
        amount: number;
        documentKind: "invoice" | "purchase";
        supplierName: string;
        docNumber: string;
        notes?: string | undefined;
    }, {
        date: string;
        category: string;
        amount: number;
        documentKind: "invoice" | "purchase";
        supplierName: string;
        docNumber: string;
        notes?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    findMatchingPayables: import("ai").Tool<z.ZodObject<{
        supplierName: z.ZodString;
        amount: z.ZodNumber;
        amountTolerance: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        supplierName: string;
        amountTolerance: number;
    }, {
        amount: number;
        supplierName: string;
        amountTolerance?: number | undefined;
    }>, {
        count: number;
        matches: {
            id: unknown;
            concept: unknown;
            amount: unknown;
            docNumber: unknown;
            date: string | null;
            supplierName: string | null;
            sourceDocumentLink: string | null;
        }[];
    }> & {
        execute: (args: {
            amount: number;
            supplierName: string;
            amountTolerance: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            matches: {
                id: unknown;
                concept: unknown;
                amount: unknown;
                docNumber: unknown;
                date: string | null;
                supplierName: string | null;
                sourceDocumentLink: string | null;
            }[];
        }>;
    };
    markInvoiceAsPaid: import("ai").Tool<z.ZodObject<{
        invoiceId: z.ZodString;
        supplierName: z.ZodString;
        docNumber: z.ZodString;
        paidDate: z.ZodString;
        amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        supplierName: string;
        docNumber: string;
        invoiceId: string;
        paidDate: string;
    }, {
        amount: number;
        supplierName: string;
        docNumber: string;
        invoiceId: string;
        paidDate: string;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=payable-tools.d.ts.map