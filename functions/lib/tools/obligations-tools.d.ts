import { z } from 'zod';
export declare function createObligationsTools(companyId: string): {
    getWeeklyObligations: import("ai").Tool<z.ZodObject<{
        weekStartDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        weekStartDate?: string | undefined;
    }, {
        weekStartDate?: string | undefined;
    }>, {
        weekRange: {
            start: string;
            end: string;
        };
        totalObligations: number;
        totalAmount: number;
        overdueCount: number;
        overdueAmount: number;
        obligations: ({
            type: "expense";
            id: unknown;
            concept: string;
            category: string;
            amount: number;
            date: string | null;
            isOverdue: boolean;
            urgency: string;
            priority: number;
        } | {
            type: "recurring";
            id: unknown;
            concept: string;
            category: string;
            amount: number;
            date: string | null;
            isOverdue: boolean;
            urgency: "recurring_due";
            priority: number;
        })[];
        payrollStatus: {
            exists: boolean;
            status?: string;
            totalNetPay?: number;
            employeeCount?: number;
        };
    }> & {
        execute: (args: {
            weekStartDate?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            weekRange: {
                start: string;
                end: string;
            };
            totalObligations: number;
            totalAmount: number;
            overdueCount: number;
            overdueAmount: number;
            obligations: ({
                type: "expense";
                id: unknown;
                concept: string;
                category: string;
                amount: number;
                date: string | null;
                isOverdue: boolean;
                urgency: string;
                priority: number;
            } | {
                type: "recurring";
                id: unknown;
                concept: string;
                category: string;
                amount: number;
                date: string | null;
                isOverdue: boolean;
                urgency: "recurring_due";
                priority: number;
            })[];
            payrollStatus: {
                exists: boolean;
                status?: string;
                totalNetPay?: number;
                employeeCount?: number;
            };
        }>;
    };
};
//# sourceMappingURL=obligations-tools.d.ts.map