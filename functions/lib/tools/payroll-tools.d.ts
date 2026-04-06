import { z } from 'zod';
export declare function createPayrollTools(companyId: string): {
    generatePayrollPreview: import("ai").Tool<z.ZodObject<{
        year: z.ZodNumber;
        month: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        month: number;
        year: number;
    }, {
        month: number;
        year: number;
    }>, {
        error: boolean;
        message: string;
        existingId: unknown;
        existingStatus: unknown;
        year?: undefined;
        month?: undefined;
        periodLabel?: undefined;
        employeeCount?: undefined;
        items?: undefined;
        totals?: undefined;
    } | {
        error: boolean;
        message: string;
        existingId?: undefined;
        existingStatus?: undefined;
        year?: undefined;
        month?: undefined;
        periodLabel?: undefined;
        employeeCount?: undefined;
        items?: undefined;
        totals?: undefined;
    } | {
        error: boolean;
        year: number;
        month: number;
        periodLabel: string;
        employeeCount: number;
        items: {
            employeeId: string;
            employeeName: string;
            employeeRole: string;
            baseSalary: number;
            auxilioTransporte: number;
            healthDeduction: number;
            pensionDeduction: number;
            totalDeductions: number;
            totalEarnings: number;
            netPay: number;
        }[];
        totals: {
            totalBaseSalary: number;
            totalAuxilio: number;
            totalDeductions: number;
            totalEarnings: number;
            totalNetPay: number;
        };
        message?: undefined;
        existingId?: undefined;
        existingStatus?: undefined;
    }> & {
        execute: (args: {
            month: number;
            year: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            error: boolean;
            message: string;
            existingId: unknown;
            existingStatus: unknown;
            year?: undefined;
            month?: undefined;
            periodLabel?: undefined;
            employeeCount?: undefined;
            items?: undefined;
            totals?: undefined;
        } | {
            error: boolean;
            message: string;
            existingId?: undefined;
            existingStatus?: undefined;
            year?: undefined;
            month?: undefined;
            periodLabel?: undefined;
            employeeCount?: undefined;
            items?: undefined;
            totals?: undefined;
        } | {
            error: boolean;
            year: number;
            month: number;
            periodLabel: string;
            employeeCount: number;
            items: {
                employeeId: string;
                employeeName: string;
                employeeRole: string;
                baseSalary: number;
                auxilioTransporte: number;
                healthDeduction: number;
                pensionDeduction: number;
                totalDeductions: number;
                totalEarnings: number;
                netPay: number;
            }[];
            totals: {
                totalBaseSalary: number;
                totalAuxilio: number;
                totalDeductions: number;
                totalEarnings: number;
                totalNetPay: number;
            };
            message?: undefined;
            existingId?: undefined;
            existingStatus?: undefined;
        }>;
    };
    createPayrollDraft: import("ai").Tool<z.ZodObject<{
        year: z.ZodNumber;
        month: z.ZodNumber;
        periodLabel: z.ZodString;
        employeeCount: z.ZodNumber;
        totalNetPay: z.ZodNumber;
        totalEarnings: z.ZodNumber;
        totalDeductions: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        month: number;
        year: number;
        periodLabel: string;
        employeeCount: number;
        totalNetPay: number;
        totalEarnings: number;
        totalDeductions: number;
    }, {
        month: number;
        year: number;
        periodLabel: string;
        employeeCount: number;
        totalNetPay: number;
        totalEarnings: number;
        totalDeductions: number;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=payroll-tools.d.ts.map