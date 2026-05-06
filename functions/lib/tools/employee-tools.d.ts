import { z } from 'zod';
export declare function createEmployeeTools(companyId: string): {
    getEmployees: import("ai").Tool<z.ZodObject<{
        department: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
    }, "strip", z.ZodTypeAny, {
        department?: string | undefined;
        status?: "active" | "inactive" | undefined;
    }, {
        department?: string | undefined;
        status?: "active" | "inactive" | undefined;
    }>, {
        count: number;
        employees: {
            id: unknown;
            name: unknown;
            identification: unknown;
            role: unknown;
            department: unknown;
            email: unknown;
            phone: unknown;
            salary: unknown;
            startDate: string | null;
            status: unknown;
        }[];
    }> & {
        execute: (args: {
            department?: string | undefined;
            status?: "active" | "inactive" | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            employees: {
                id: unknown;
                name: unknown;
                identification: unknown;
                role: unknown;
                department: unknown;
                email: unknown;
                phone: unknown;
                salary: unknown;
                startDate: string | null;
                status: unknown;
            }[];
        }>;
    };
    getEmployee: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>, {
        id: unknown;
        name: unknown;
        identification: unknown;
        role: unknown;
        department: unknown;
        email: unknown;
        phone: unknown;
        salary: unknown;
        startDate: string | null;
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
            role: unknown;
            department: unknown;
            email: unknown;
            phone: unknown;
            salary: unknown;
            startDate: string | null;
            status: unknown;
        } | {
            error: string;
        }>;
    };
};
//# sourceMappingURL=employee-tools.d.ts.map