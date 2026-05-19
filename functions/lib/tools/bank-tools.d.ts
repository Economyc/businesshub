import { z } from 'zod';
export declare function createBankTools(companyId: string): {
    getBankReconcileStatus: import("ai").Tool<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>, {
        count: number;
        pendingReconcile: number;
        statements: {
            statementId: string;
            fileName: any;
            bank: any;
            periodStart: string | null;
            periodEnd: string | null;
            rowCount: any;
            status: any;
        }[];
    }> & {
        execute: (args: {}, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            pendingReconcile: number;
            statements: {
                statementId: string;
                fileName: any;
                bank: any;
                periodStart: string | null;
                periodEnd: string | null;
                rowCount: any;
                status: any;
            }[];
        }>;
    };
    getBankMovements: import("ai").Tool<z.ZodObject<{
        statementId: z.ZodOptional<z.ZodString>;
        onlyUnreconciled: z.ZodOptional<z.ZodBoolean>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        statementId?: string | undefined;
        onlyUnreconciled?: boolean | undefined;
    }, {
        limit?: number | undefined;
        statementId?: string | undefined;
        onlyUnreconciled?: boolean | undefined;
    }>, {
        found: boolean;
        message: string;
        statementId?: undefined;
        totalMovements?: undefined;
        totalIn?: undefined;
        totalOut?: undefined;
        byStatus?: undefined;
        movements?: undefined;
    } | {
        found: boolean;
        statementId: string;
        totalMovements: number;
        totalIn: number;
        totalOut: number;
        byStatus: Record<string, number>;
        movements: {
            id: string;
            date: string | null;
            description: any;
            amount: number;
            direction: any;
            classification: any;
            reconcileStatus: any;
        }[];
        message?: undefined;
    }> & {
        execute: (args: {
            limit: number;
            statementId?: string | undefined;
            onlyUnreconciled?: boolean | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            found: boolean;
            message: string;
            statementId?: undefined;
            totalMovements?: undefined;
            totalIn?: undefined;
            totalOut?: undefined;
            byStatus?: undefined;
            movements?: undefined;
        } | {
            found: boolean;
            statementId: string;
            totalMovements: number;
            totalIn: number;
            totalOut: number;
            byStatus: Record<string, number>;
            movements: {
                id: string;
                date: string | null;
                description: any;
                amount: number;
                direction: any;
                classification: any;
                reconcileStatus: any;
            }[];
            message?: undefined;
        }>;
    };
    reconcileBank: import("ai").Tool<z.ZodObject<{
        statementId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        statementId?: string | undefined;
    }, {
        statementId?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=bank-tools.d.ts.map